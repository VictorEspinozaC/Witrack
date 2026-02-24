import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import '../db/app_database.dart';
import '../models/models.dart';
import '../services/sync_service.dart';
import '../theme/app_theme.dart';

class ReceptionScreen extends StatefulWidget {
  final String shipmentId;

  const ReceptionScreen({super.key, required this.shipmentId});

  @override
  State<ReceptionScreen> createState() => _ReceptionScreenState();
}

class _ReceptionScreenState extends State<ReceptionScreen> {
  final _db = AppDatabase.instance;
  final _picker = ImagePicker();
  
  // Estado
  bool _hasIssues = false;
  String? _photoPath;
  final _descriptionController = TextEditingController();
  IncidentType _selectedType = IncidentType.faltante;
  bool _saving = false;

  Future<void> _takePhoto() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      imageQuality: 85,
    );
    
    if (image == null) return;

    final dir = await getApplicationDocumentsDirectory();
    final incidentsDir = Directory(p.join(dir.path, 'incidents'));
    if (!await incidentsDir.exists()) {
      await incidentsDir.create(recursive: true);
    }

    final fileName = 'incident_${widget.shipmentId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final savedPath = p.join(incidentsDir.path, fileName);
    await File(image.path).copy(savedPath);

    setState(() => _photoPath = savedPath);
  }

  Future<void> _processReception() async {
    setState(() => _saving = true);

    try {
      if (_hasIssues) {
        if (_descriptionController.text.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Por favor describe la incidencia')),
          );
          setState(() => _saving = false);
          return;
        }

        // Registrar incidencia
        await _db.insertIncident(Incident(
          shipmentId: widget.shipmentId,
          type: _selectedType,
          description: _descriptionController.text,
          photoPath: _photoPath,
          status: IncidentStatus.abierta,
        ));

        // El status del shipment se actualiza automáticamente a 'incidencia' 
        // dentro de insertIncident en el AppDatabase, pero asegurémonos de que
        // la recepción se marque también (fecha).
        
        // Pero espera, si hay incidencia, el flujo normal es "Incidencia".
        // ¿Deberíamos marcar también fecha de recepción? Sí, llegó igual.
        await _db.receiveShipment(widget.shipmentId); 
        // Sobreescribir el estado a incidencia porque receiveShipment lo pone en recibido
        await _db.updateShipmentStatus(widget.shipmentId, ShipmentStatus.incidencia);

      } else {
        // Recepción limpia
        await _db.receiveShipment(widget.shipmentId);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recepción registrada correctamente')),
        );
        // Sincronizar recepción
        SyncService().syncAll();
        Navigator.pop(context, true); // Retorna true para indicar cambio
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recepción en Sucursal')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusSelector(),
            const SizedBox(height: 24),
            
            if (_hasIssues) ...[
              Text(
                'Detalle de la Incidencia',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildIncidentForm(),
              const SizedBox(height: 24),
            ],

            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _processReception,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _hasIssues ? Colors.orange : AppTheme.successColor,
                ),
                icon: _saving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Icon(_hasIssues ? Icons.warning : Icons.check_circle),
                label: Text(
                  _saving ? 'PROCESANDO...' : (_hasIssues ? 'REGISTRAR CON INCIDENCIA' : 'CONFIRMAR RECEPCIÓN OK'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusSelector() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            RadioListTile<bool>(
              title: const Text('Recepción Conforme (Todo OK)'),
              subtitle: const Text('La carga llegó completa y en buen estado'),
              value: false,
              groupValue: _hasIssues,
              onChanged: (v) => setState(() => _hasIssues = v!),
              activeColor: AppTheme.successColor,
              secondary: const Icon(Icons.check_circle, color: AppTheme.successColor),
            ),
            const Divider(),
            RadioListTile<bool>(
              title: const Text('Reportar Problema'),
              subtitle: const Text('Hay daños, faltantes o diferencias'),
              value: true,
              groupValue: _hasIssues,
              onChanged: (v) => setState(() => _hasIssues = v!),
              activeColor: Colors.orange,
              secondary: const Icon(Icons.warning, color: Colors.orange),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIncidentForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<IncidentType>(
              value: _selectedType,
              decoration: const InputDecoration(labelText: 'Tipo de Problema'),
              items: IncidentType.values.map((t) => DropdownMenuItem(
                value: t,
                child: Text(t.name.toUpperCase()),
              )).toList(),
              onChanged: (v) => setState(() => _selectedType = v!),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Descripción del problema',
                hintText: 'Ej: Faltan 2 pallets, caja mojada...',
                alignLabelWithHint: true,
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            const Text('Evidencia Fotográfica (Opcional)', style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            InkWell(
              onTap: _takePhoto,
              child: Container(
                height: 150,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: _photoPath != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(
                          File(_photoPath!),
                          fit: BoxFit.cover,
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.camera_alt, size: 40, color: Colors.grey),
                          Text('Tocar para tomar foto', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
              ),
            ),
            if (_photoPath != null)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: TextButton.icon(
                  onPressed: () => setState(() => _photoPath = null),
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text('Eliminar foto', style: TextStyle(color: Colors.red)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

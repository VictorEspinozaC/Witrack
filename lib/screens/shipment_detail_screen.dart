import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/gps_service.dart';
import '../services/photo_upload_service.dart';
import '../services/sync_service.dart';
import 'load_management_screen.dart';
import 'reception_screen.dart';

/// Pantalla de detalle de un shipment con historial y acciones
class ShipmentDetailScreen extends StatefulWidget {
  final String shipmentId;

  const ShipmentDetailScreen({super.key, required this.shipmentId});

  @override
  State<ShipmentDetailScreen> createState() => _ShipmentDetailScreenState();
}

class _ShipmentDetailScreenState extends State<ShipmentDetailScreen> {
  final _db = AppDatabase.instance;
  
  Shipment? _shipment;
  Truck? _truck;
  Driver? _driver;
  Branch? _branch;
  List<LoadPhoto> _photos = [];
  List<Incident> _incidents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    
    final shipment = await _db.getShipmentById(widget.shipmentId);
    if (shipment == null) {
      if (mounted) Navigator.pop(context);
      return;
    }

    final truck = await _db.getTruckById(shipment.truckId);
    final driver = await _db.getDriverById(shipment.driverId);
    final branch = await _db.getBranchById(shipment.branchId);
    final photos = await _db.getPhotosForShipment(widget.shipmentId);
    final incidents = await _db.getIncidentsForShipment(widget.shipmentId);

    setState(() {
      _shipment = shipment;
      _truck = truck;
      _driver = driver;
      _branch = branch;
      _photos = photos;
      _incidents = incidents;
      _loading = false;
    });
  }

  Future<void> _updateStatus(ShipmentStatus newStatus) async {
    switch (newStatus) {
      case ShipmentStatus.enEspera:
        await _db.updateShipmentStatus(widget.shipmentId, newStatus);
        break;
      case ShipmentStatus.enCarga:
        await _db.startLoad(widget.shipmentId);
        break;
      case ShipmentStatus.cargado:
        await _db.endLoad(widget.shipmentId);
        break;
      case ShipmentStatus.despachado:
        await GpsService().dispatchWithLocation(widget.shipmentId);
        break;
      case ShipmentStatus.recibido:
        // Ya está recibido, quizás solo mostrar detalle
        break;
      default:
        await _db.updateShipmentStatus(widget.shipmentId, newStatus);
    }
    await _loadData();
    // Iniciar sincronización en background
    SyncService().syncAll();
  }

  Future<void> _showResolveDialog(Incident incident) async {
    final controller = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Resolver Incidencia'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Ingresa la resolución o acuerdo final:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                hintText: 'Ej: Se acordó nota de crédito',
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Resolver'),
          ),
        ],
      ),
    );

    if (result == true) {
      await _db.resolveIncident(incident.id!, controller.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Incidencia resuelta ✅')),
        );
        _loadData();
        // Iniciar sincronización en background
        SyncService().syncAll();
      }
    }
  }

  Future<void> _showReportIncidentDialog() async {
    IncidentType selectedType = IncidentType.faltante;
    final descriptionController = TextEditingController();
    File? photoFile;
    
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.warning, color: Colors.orange, size: 28),
                  const SizedBox(width: 12),
                  Text(
                    'Reportar Incidencia',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              
              // Tipo de incidencia
              const Text('Tipo de incidencia:', style: TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: IncidentType.values.map((type) {
                  final isSelected = type == selectedType;
                  return ChoiceChip(
                    label: Text(_getTypeName(type)),
                    selected: isSelected,
                    onSelected: (_) => setModalState(() => selectedType = type),
                    selectedColor: Colors.orange.shade100,
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              
              // Descripción
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Descripción',
                  hintText: 'Detalla el problema encontrado...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              
              // Foto
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final picker = ImagePicker();
                        final image = await picker.pickImage(source: ImageSource.camera);
                        if (image != null) {
                          setModalState(() => photoFile = File(image.path));
                        }
                      },
                      icon: const Icon(Icons.camera_alt),
                      label: Text(photoFile != null ? 'Foto capturada ✓' : 'Tomar foto'),
                    ),
                  ),
                  if (photoFile != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () => setModalState(() => photoFile = null),
                      icon: const Icon(Icons.close, color: Colors.red),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 20),
              
              // Botones
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: descriptionController.text.isEmpty 
                          ? null 
                          : () => Navigator.pop(context, true),
                      icon: const Icon(Icons.send),
                      label: const Text('Reportar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );

    if (result == true && descriptionController.text.isNotEmpty) {
      // Subir foto si existe
      String? photoUrl;
      if (photoFile != null) {
        photoUrl = await PhotoUploadService().uploadIncidentPhoto(
          photoFile!, 
          widget.shipmentId, // Ahora es String
        );
      }

      // Crear incidencia
      final incident = Incident(
        shipmentId: widget.shipmentId,
        type: selectedType,
        description: descriptionController.text,
        photoPath: photoUrl,
      );
      
      await _db.insertIncident(incident);
      
      if (mounted) {
        _loadData();
        // Iniciar sincronización en background
        SyncService().syncAll();
      }
    }
  }

  String _getTypeName(IncidentType type) {
    switch (type) {
      case IncidentType.faltante: return 'Faltante';
      case IncidentType.danado: return 'Dañado';
      case IncidentType.diferencia: return 'Diferencia';
      case IncidentType.otro: return 'Otro';
    }
  }

  void _openLoadManagement() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LoadManagementScreen(shipmentId: widget.shipmentId),
      ),
    ).then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Detalle')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final shipment = _shipment!;
    final statusColor = AppTheme.getStatusColor(shipment.status.name);
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text(_truck?.plate ?? 'Detalle'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // Header con estado
              _buildStatusHeader(shipment, statusColor),
              
              // Información del camión y chofer
              _buildInfoSection(),
              
              // Timeline de eventos
              _buildTimeline(shipment, dateFormat),
              
              // Fotos
              if (_photos.isNotEmpty) _buildPhotosSection(),
              
              // Incidencias - siempre mostrar para permitir reportar nuevas
              _buildIncidentsSection(),
              
              // Espaciado para FAB
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
      floatingActionButton: _buildActionButton(shipment),
    );
  }

  Widget _buildStatusHeader(Shipment shipment, Color statusColor) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            statusColor.withOpacity(0.8),
            statusColor,
          ],
        ),
      ),
      child: Column(
        children: [
          Icon(
            _getStatusIcon(shipment.status),
            size: 48,
            color: Colors.white,
          ),
          const SizedBox(height: 12),
          Text(
            shipment.status.displayName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (shipment.notes != null && shipment.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                shipment.notes!,
                style: const TextStyle(color: Colors.white),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _getStatusIcon(ShipmentStatus status) {
    switch (status) {
      case ShipmentStatus.esperaIngreso:
        return Icons.pending_actions;
      case ShipmentStatus.enEspera:
        return Icons.hourglass_empty;
      case ShipmentStatus.enCarga:
        return Icons.downloading;
      case ShipmentStatus.cargado:
        return Icons.check_circle;
      case ShipmentStatus.amarre:
        return Icons.link; // O Icons.security, Icons.construction
      case ShipmentStatus.despachado:
        return Icons.local_shipping;
      case ShipmentStatus.recibido:
        return Icons.inventory;
      case ShipmentStatus.incidencia:
        return Icons.warning;
      case ShipmentStatus.resuelto:
        return Icons.verified;
    }
  }

  Widget _buildInfoSection() {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Información',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _InfoRow(
              icon: Icons.local_shipping,
              label: 'Camión',
              value: _truck?.plate ?? '-',
              valueStyle: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5,
              ),
            ),
            const Divider(height: 24),
            _InfoRow(
              icon: Icons.person,
              label: 'Chofer',
              value: _driver?.name ?? '-',
            ),
            const Divider(height: 24),
            _InfoRow(
              icon: Icons.badge,
              label: 'RUT',
              value: _driver?.rut ?? '-',
            ),
            if (_driver?.phone != null) ...[
              const Divider(height: 24),
              _InfoRow(
                icon: Icons.phone,
                label: 'Teléfono',
                value: _driver!.phone!,
              ),
            ],
            const Divider(height: 24),
            _InfoRow(
              icon: Icons.store,
              label: 'Sucursal Destino',
              value: _branch != null ? '${_branch!.name} (${_branch!.code})' : '-',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeline(Shipment shipment, DateFormat dateFormat) {
    final events = <_TimelineEvent>[];

    if (shipment.arrivalTime != null) {
      events.add(_TimelineEvent(
        time: dateFormat.format(shipment.arrivalTime!),
        title: 'Llegada registrada',
        icon: Icons.login,
        color: AppTheme.getStatusColor('esperaIngreso'),
      ));
    }

    if (shipment.loadStart != null) {
      events.add(_TimelineEvent(
        time: dateFormat.format(shipment.loadStart!),
        title: 'Inicio de carga',
        icon: Icons.downloading,
        color: AppTheme.getStatusColor('enCarga'),
      ));
    }

    if (shipment.loadEnd != null) {
      events.add(_TimelineEvent(
        time: dateFormat.format(shipment.loadEnd!),
        title: 'Fin de carga',
        icon: Icons.check_circle,
        color: AppTheme.getStatusColor('cargado'),
      ));
    }

    // Nota: El estado de 'amarre' no tiene un campo de fecha específico en el modelo actual, 
    // pero podríamos usar el tiempo de actualización si fuera necesario. 
    // Por ahora solo mostramos si ocurrió el evento de despacho posterior.

    if (shipment.dispatchTime != null) {
      events.add(_TimelineEvent(
        time: dateFormat.format(shipment.dispatchTime!),
        title: 'Despachado',
        icon: Icons.local_shipping,
        color: AppTheme.getStatusColor('despachado'),
      ));
    }

    if (shipment.receptionTime != null) {
      events.add(_TimelineEvent(
        time: dateFormat.format(shipment.receptionTime!),
        title: 'Recibido en sucursal',
        icon: Icons.inventory,
        color: AppTheme.getStatusColor('recibido'),
      ));
    }

    if (events.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Historial',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ...events.asMap().entries.map((entry) {
              final isLast = entry.key == events.length - 1;
              final event = entry.value;
              return _TimelineItem(event: event, isLast: isLast);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Fotos de Carga',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _openLoadManagement,
                  icon: const Icon(Icons.add_a_photo, size: 18),
                  label: const Text('Agregar'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 100,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  final photo = _photos[index];
                  return Container(
                    width: 100,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.grey.shade200,
                    ),
                    child: const Icon(Icons.image, size: 40, color: Colors.grey),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIncidentsSection() {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning, color: Colors.orange),
                const SizedBox(width: 8),
                Text(
                  'Incidencias',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _showReportIncidentDialog,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Reportar'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.orange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ..._incidents.map((incident) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: incident.status == IncidentStatus.resuelta
                    ? Colors.green.shade100
                    : Colors.red.shade100,
                child: Icon(
                  incident.status == IncidentStatus.resuelta
                      ? Icons.check
                      : Icons.warning,
                  color: incident.status == IncidentStatus.resuelta
                      ? Colors.green
                      : Colors.red,
                ),
              ),
              title: Text(incident.type.name.toUpperCase()),
              subtitle: Text(incident.description),
              trailing: Text(
                incident.status.name,
                style: TextStyle(
                  color: incident.status == IncidentStatus.resuelta
                      ? Colors.green
                      : Colors.orange,
                ),
              ),
              onTap: incident.status != IncidentStatus.resuelta
                  ? () => _showResolveDialog(incident)
                  : null,
            )),
          ],
        ),
      ),
    );
  }

  Widget? _buildActionButton(Shipment shipment) {
    final status = shipment.status;
    final user = Provider.of<AuthService>(context, listen: false).currentUser;
    if (user == null) return null;

    final isPlanta = user.isPlanta;
    final isSucursal = user.isSucursal;
    
    // Definir la siguiente acción según el estado actual
    String? label;
    IconData? icon;
    VoidCallback? onPressed;

    switch (status) {
      case ShipmentStatus.esperaIngreso:
        // Lógica de ingreso es automática por OCR
        return null;
        
      case ShipmentStatus.enEspera:
        if (!isPlanta) return null;
        label = 'Iniciar Carga';
        icon = Icons.downloading;
        onPressed = () => _updateStatus(ShipmentStatus.enCarga);
        break;
        
      case ShipmentStatus.enCarga:
        if (!isPlanta) return null;
        label = 'Finalizar Carga';
        icon = Icons.check_circle;
        onPressed = _openLoadManagement;
        break;
        
      case ShipmentStatus.cargado:
        if (!isPlanta) return null;
        label = 'Iniciar Amarre';
        icon = Icons.link;
        onPressed = () => _updateStatus(ShipmentStatus.amarre);
        break;
        
      case ShipmentStatus.amarre:
        if (!isPlanta) return null;
        label = 'Despachar';
        icon = Icons.local_shipping;
        onPressed = () => _updateStatus(ShipmentStatus.despachado);
        break;
        
      case ShipmentStatus.despachado:
        if (!isSucursal) return null;
        label = 'Confirmar Recepción';
        icon = Icons.inventory;
        onPressed = () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ReceptionScreen(shipmentId: widget.shipmentId), // Ahora es String
            ),
          );
          if (result == true) _loadData();
        };
        break;
        
      default:
        return null;
    }

    return FloatingActionButton.extended(
      onPressed: onPressed,
      icon: Icon(icon),
      label: Text(label),
      backgroundColor: AppTheme.secondaryColor,
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final TextStyle? valueStyle;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.secondaryColor, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 12,
              ),
            ),
            Text(
              value,
              style: valueStyle ?? const TextStyle(fontSize: 15),
            ),
          ],
        ),
      ],
    );
  }
}

class _TimelineEvent {
  final String time;
  final String title;
  final IconData icon;
  final Color color;

  _TimelineEvent({
    required this.time,
    required this.title,
    required this.icon,
    required this.color,
  });
}

class _TimelineItem extends StatelessWidget {
  final _TimelineEvent event;
  final bool isLast;

  const _TimelineItem({required this.event, required this.isLast});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: event.color,
                  shape: BoxShape.circle,
                ),
                child: Icon(event.icon, color: Colors.white, size: 18),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: Colors.grey.shade300,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  Text(
                    event.time,
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import '../db/app_database.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

/// Pantalla de gestión de carga: fotos, comentarios, inicio/fin
class LoadManagementScreen extends StatefulWidget {
  final int shipmentId;

  const LoadManagementScreen({super.key, required this.shipmentId});

  @override
  State<LoadManagementScreen> createState() => _LoadManagementScreenState();
}

class _LoadManagementScreenState extends State<LoadManagementScreen> {
  final _db = AppDatabase.instance;
  final _picker = ImagePicker();
  final _commentController = TextEditingController();
  
  Shipment? _shipment;
  Truck? _truck;
  List<LoadPhoto> _photos = [];
  bool _loading = true;
  bool _saving = false;

  // Para edición de hora
  TimeOfDay? _loadStartTime;
  TimeOfDay? _loadEndTime;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    
    final shipment = await _db.getShipmentById(widget.shipmentId);
    if (shipment == null) {
      if (mounted) Navigator.pop(context);
      return;
    }

    final truck = await _db.getTruckById(shipment.truckId);
    final photos = await _db.getPhotosForShipment(widget.shipmentId);

    setState(() {
      _shipment = shipment;
      _truck = truck;
      _photos = photos;
      _loadStartTime = shipment.loadStart != null
          ? TimeOfDay.fromDateTime(shipment.loadStart!)
          : null;
      _loadEndTime = shipment.loadEnd != null
          ? TimeOfDay.fromDateTime(shipment.loadEnd!)
          : null;
      _loading = false;
    });
  }

  Future<void> _takePhoto() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      maxHeight: 1080,
      imageQuality: 85,
    );
    
    if (image == null) return;

    setState(() => _saving = true);

    try {
      // Guardar imagen en directorio de la app
      final dir = await getApplicationDocumentsDirectory();
      final photoDir = Directory(p.join(dir.path, 'load_photos'));
      if (!await photoDir.exists()) {
        await photoDir.create(recursive: true);
      }

      final fileName = 'shipment_${widget.shipmentId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final savedPath = p.join(photoDir.path, fileName);
      await File(image.path).copy(savedPath);

      // Guardar en BD
      await _db.insertLoadPhoto(LoadPhoto(
        shipmentId: widget.shipmentId,
        path: savedPath,
        comment: _commentController.text.trim().isNotEmpty
            ? _commentController.text.trim()
            : null,
      ));

      _commentController.clear();
      await _loadData();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto guardada ✅')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al guardar foto: $e')),
        );
      }
    } finally {
      setState(() => _saving = false);
    }
  }

  Future<void> _pickFromGallery() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      maxHeight: 1080,
      imageQuality: 85,
    );
    
    if (image == null) return;

    setState(() => _saving = true);

    try {
      final dir = await getApplicationDocumentsDirectory();
      final photoDir = Directory(p.join(dir.path, 'load_photos'));
      if (!await photoDir.exists()) {
        await photoDir.create(recursive: true);
      }

      final fileName = 'shipment_${widget.shipmentId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final savedPath = p.join(photoDir.path, fileName);
      await File(image.path).copy(savedPath);

      await _db.insertLoadPhoto(LoadPhoto(
        shipmentId: widget.shipmentId,
        path: savedPath,
        comment: _commentController.text.trim().isNotEmpty
            ? _commentController.text.trim()
            : null,
      ));

      _commentController.clear();
      await _loadData();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto guardada ✅')),
        );
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

  Future<void> _deletePhoto(LoadPhoto photo) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar foto'),
        content: const Text('¿Estás seguro de eliminar esta foto?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await _db.deleteLoadPhoto(photo.id!);
    
    // Intentar eliminar archivo
    try {
      final file = File(photo.path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}

    await _loadData();
  }

  Future<void> _selectLoadStartTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _loadStartTime ?? TimeOfDay.now(),
    );
    if (time != null) {
      setState(() => _loadStartTime = time);
    }
  }

  Future<void> _selectLoadEndTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _loadEndTime ?? TimeOfDay.now(),
    );
    if (time != null) {
      setState(() => _loadEndTime = time);
    }
  }

  Future<void> _startLoad() async {
    final now = DateTime.now();
    final time = _loadStartTime != null
        ? DateTime(now.year, now.month, now.day, _loadStartTime!.hour, _loadStartTime!.minute)
        : now;

    await _db.startLoad(widget.shipmentId, time: time);
    await _loadData();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Carga iniciada ✅')),
      );
    }
  }

  Future<void> _endLoad() async {
    if (_photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos una foto de la carga')),
      );
      return;
    }

    final now = DateTime.now();
    final time = _loadEndTime != null
        ? DateTime(now.year, now.month, now.day, _loadEndTime!.hour, _loadEndTime!.minute)
        : now;

    await _db.endLoad(widget.shipmentId, time: time);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Carga finalizada ✅')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Gestión de Carga')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final shipment = _shipment!;
    final isInLoad = shipment.status == ShipmentStatus.enCarga;
    final canStart = shipment.status == ShipmentStatus.enEspera;
    final dateFormat = DateFormat('HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text(_truck?.plate ?? 'Gestión de Carga'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Estado actual
            _buildStatusCard(shipment),
            const SizedBox(height: 16),

            // Tiempos de carga
            _buildTimeCard(shipment, dateFormat, canStart, isInLoad),
            const SizedBox(height: 16),

            // Sección de fotos
            _buildPhotosSection(),
            const SizedBox(height: 16),

            // Campo de comentario
            _buildCommentField(),
            const SizedBox(height: 16),

            // Botones de acción
            _buildActionButtons(canStart, isInLoad),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(Shipment shipment) {
    final statusColor = AppTheme.getStatusColor(shipment.status.name);
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_shipping, color: Colors.white),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Estado Actual',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                Text(
                  shipment.status.displayName,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeCard(Shipment shipment, DateFormat dateFormat, bool canStart, bool isInLoad) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tiempos de Carga',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _TimeField(
                    label: 'Inicio',
                    time: _loadStartTime,
                    enabled: canStart || isInLoad,
                    onTap: _selectLoadStartTime,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _TimeField(
                    label: 'Fin',
                    time: _loadEndTime,
                    enabled: isInLoad,
                    onTap: _selectLoadEndTime,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    return Card(
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
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_photos.length}',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_photos.isEmpty)
              Container(
                height: 120,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.grey.shade300,
                    style: BorderStyle.solid,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_a_photo, size: 40, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    Text(
                      'Agrega fotos de la carga',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ],
                ),
              )
            else
              SizedBox(
                height: 120,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _photos.length,
                  itemBuilder: (context, index) {
                    final photo = _photos[index];
                    return _PhotoThumbnail(
                      photo: photo,
                      onDelete: () => _deletePhoto(photo),
                    );
                  },
                ),
              ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _takePhoto,
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Cámara'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _pickFromGallery,
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Galería'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentField() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comentario (opcional)',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(
                hintText: 'Agregar comentario para la próxima foto...',
                prefixIcon: Icon(Icons.comment),
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(bool canStart, bool isInLoad) {
    if (canStart) {
      return SizedBox(
        width: double.infinity,
        height: 56,
        child: ElevatedButton.icon(
          onPressed: _startLoad,
          icon: const Icon(Icons.play_arrow),
          label: const Text('INICIAR CARGA', style: TextStyle(fontSize: 16)),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.accentColor,
          ),
        ),
      );
    }

    if (isInLoad) {
      return SizedBox(
        width: double.infinity,
        height: 56,
        child: ElevatedButton.icon(
          onPressed: _endLoad,
          icon: const Icon(Icons.check_circle),
          label: const Text('FINALIZAR CARGA', style: TextStyle(fontSize: 16)),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.successColor,
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

class _TimeField extends StatelessWidget {
  final String label;
  final TimeOfDay? time;
  final bool enabled;
  final VoidCallback onTap;

  const _TimeField({
    required this.label,
    required this.time,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: enabled ? Colors.white : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  Icons.access_time,
                  size: 20,
                  color: enabled ? AppTheme.primaryColor : Colors.grey,
                ),
                const SizedBox(width: 8),
                Text(
                  time != null
                      ? '${time!.hour.toString().padLeft(2, '0')}:${time!.minute.toString().padLeft(2, '0')}'
                      : '--:--',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: enabled ? Colors.black : Colors.grey,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoThumbnail extends StatelessWidget {
  final LoadPhoto photo;
  final VoidCallback onDelete;

  const _PhotoThumbnail({required this.photo, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      margin: const EdgeInsets.only(right: 12),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.file(
              File(photo.path),
              width: 120,
              height: 120,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 120,
                height: 120,
                color: Colors.grey.shade300,
                child: const Icon(Icons.broken_image),
              ),
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: onDelete,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Colors.red,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 16),
              ),
            ),
          ),
          if (photo.comment != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(8),
                    bottomRight: Radius.circular(8),
                  ),
                ),
                child: Text(
                  photo.comment!,
                  style: const TextStyle(color: Colors.white, fontSize: 10),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

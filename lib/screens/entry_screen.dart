import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../db/vehicle_log_db.dart';
import '../utils/validators.dart';
import 'camera_screen.dart';

class EntryScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  const EntryScreen({super.key, required this.cameras});

  @override
  State<EntryScreen> createState() => _EntryScreenState();
}

class _EntryScreenState extends State<EntryScreen> {
  String? _plate;
  final _name = TextEditingController();
  final _rut = TextEditingController();

  Future<void> _scanPlate() async {
    final plate = await Navigator.push<String?>(
      context,
      MaterialPageRoute(builder: (_) => CameraScreen(cameras: widget.cameras)),
    );
    if (plate != null && mounted) setState(() => _plate = plate);
  }

  Future<void> _save() async {
    final plate = _plate;
    final name = _name.text.trim();
    final rut = _rut.text.trim();

    if (plate == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Primero lee una patente')));
      return;
    }
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa nombre del chofer')));
      return;
    }
    if (!isValidRut(rut)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('RUT inválido')));
      return;
    }

    await VehicleLogDb.instance.insertEntry(
      plate: normalizePlate(plate),
      driverName: name,
      driverRut: rut,
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingreso guardado ✅')));
    setState(() {
      _plate = null;
      _name.clear();
      _rut.clear();
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _rut.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ingreso')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _scanPlate,
                icon: const Icon(Icons.camera_alt),
                label: Text(_plate == null ? 'Leer patente' : 'Releer patente (${_plate!})'),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nombre chofer'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _rut,
              decoration: const InputDecoration(labelText: 'RUT (ej: 12345678-5)'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _save,
                child: const Text('Guardar ingreso'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

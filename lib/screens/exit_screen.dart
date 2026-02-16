import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../db/vehicle_log_db.dart';
import '../utils/validators.dart';
import 'camera_screen.dart';

class ExitScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  const ExitScreen({super.key, required this.cameras});

  @override
  State<ExitScreen> createState() => _ExitScreenState();
}

class _ExitScreenState extends State<ExitScreen> {
  String? _plate;

  Future<void> _scanAndClose() async {
    final plate = await Navigator.push<String?>(
      context,
      MaterialPageRoute(builder: (_) => CameraScreen(cameras: widget.cameras)),
    );
    if (plate == null || !mounted) return;

    final norm = normalizePlate(plate);
    setState(() => _plate = norm);

    final open = await VehicleLogDb.instance.findOpenByPlate(norm);
    if (open == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No hay ingreso ABIERTO para $norm')),
      );
      return;
    }

    await VehicleLogDb.instance.closeOpenLog(open.id!);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Salida registrada ✅ ($norm)')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Salida')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _scanAndClose,
                icon: const Icon(Icons.camera_alt),
                label: Text(_plate == null ? 'Leer patente y cerrar' : 'Releer / cerrar (${_plate!})'),
              ),
            ),
            const SizedBox(height: 16),
            const Text('La salida solo se registra si existe un ingreso OPEN para esa patente.'),
          ],
        ),
      ),
    );
  }
}

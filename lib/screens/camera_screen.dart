import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../services/plate_ocr_service.dart';

enum ScanMode { plate, id }

class CameraScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  final ScanMode mode;

  const CameraScreen({
    super.key, 
    required this.cameras,
    this.mode = ScanMode.plate,
  });

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  CameraController? _controller;
  bool _busy = false;
  final _ocr = PlateOcrService();

  double _minZoom = 1.0;
  double _maxZoom = 1.0;
  double _currentZoom = 1.0;

  @override
  void initState() {
    super.initState();

    final back = widget.cameras.firstWhere(
          (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => widget.cameras.first,
    );

    _controller = CameraController(back, ResolutionPreset.medium, enableAudio: false);
    _controller!.initialize().then((_) async {
      if (!mounted) return;
      
      // Obtener capacidades de zoom
      _minZoom = await _controller!.getMinZoomLevel();
      _maxZoom = await _controller!.getMaxZoomLevel();
      
      // Aplicar zoom inicial de 2.0x (dentro de los límites)
      double targetZoom = 2.0;
      if (targetZoom < _minZoom) targetZoom = _minZoom;
      if (targetZoom > _maxZoom) targetZoom = _maxZoom;
      
      await _controller!.setZoomLevel(targetZoom);
      _currentZoom = targetZoom;
      
      setState(() {});
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    _ocr.dispose();
    super.dispose();
  }

  Future<void> _captureAndRead() async {
    if (_controller == null || !_controller!.value.isInitialized || _busy) return;

    setState(() => _busy = true);
    try {
      final xfile = await _controller!.takePicture();
      
      dynamic result;
      if (widget.mode == ScanMode.plate) {
        result = await _ocr.readPlateFromFile(File(xfile.path));
      } else {
        result = await _ocr.readIdCardFromFile(File(xfile.path));
      }

      if (!mounted) return;

      if (result == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(
            widget.mode == ScanMode.plate 
              ? 'No se detectó patente.' 
              : 'No se detectó información del carnet.'
          )),
        );
        setState(() => _busy = false);
        return;
      }

      Navigator.pop(context, result);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error usando la cámara / OCR')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    if (c == null || !c.value.isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Dimensiones overlay
    final size = MediaQuery.of(context).size;
    final isId = widget.mode == ScanMode.id;
    final overlayWidth = size.width * (isId ? 0.85 : 0.85);
    final overlayHeight = isId ? size.width * 0.85 * 0.63 : 110.0; // Proporción carnet vs patente

    return Scaffold(
      appBar: AppBar(title: Text(isId ? 'Escanear Cédula' : 'Leer patente')),
      body: Stack(
        children: [
          CameraPreview(c),
          
          // Slider de Zoom
          Positioned(
            right: 10,
            top: 20,
            bottom: 150,
            child: RotatedBox(
              quarterTurns: 3,
              child: SizedBox(
                width: 300,
                child: Slider(
                  value: _currentZoom,
                  min: _minZoom,
                  max: _maxZoom,
                  activeColor: Colors.white,
                  inactiveColor: Colors.white30,
                  onChanged: (value) {
                    setState(() {
                      _currentZoom = value;
                    });
                    _controller?.setZoomLevel(value);
                  },
                ),
              ),
            ),
          ),
          
          Center(
            child: Container(
              width: overlayWidth,
              height: overlayHeight,
              decoration: BoxDecoration(
                border: Border.all(width: 3, color: Colors.greenAccent),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_maxZoom > 1.0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Text(
                      'Zoom: ${_currentZoom.toStringAsFixed(1)}x',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                TextButton.icon(
                  onPressed: _showManualEntryDialog,
                  icon: const Icon(Icons.keyboard, color: Colors.white),
                  label: const Text(
                    'Ingresar manualmente',
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.black45,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: _busy ? null : _captureAndRead,
                    icon: _busy
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator())
                        : const Icon(Icons.camera),
                    label: Text(_busy ? 'Leyendo…' : 'Capturar y leer'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showManualEntryDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ingreso Manual'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Patente',
            hintText: 'ABCD12',
            border: OutlineInputBorder(),
          ),
          textCapitalization: TextCapitalization.characters,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                Navigator.pop(context); // Close dialog
                Navigator.pop(context, controller.text.trim()); // Return to previous screen
              }
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }
}

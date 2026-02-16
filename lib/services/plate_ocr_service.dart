import 'dart:io';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../utils/validators.dart';

class PlateOcrService {
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);

  Future<String?> readPlateFromFile(File file) async {
    final input = InputImage.fromFile(file);
    final recognized = await _recognizer.processImage(input);
    return extractPlateCandidate(recognized.text);
  }

  Future<Map<String, String>?> readIdCardFromFile(File file) async {
    final input = InputImage.fromFile(file);
    final recognized = await _recognizer.processImage(input);
    final text = recognized.text;

    // Buscar RUT
    // Formatos posibles: 12.345.678-9, 12345678-9, 12.345.678-K
    final rutRegex = RegExp(r'(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])');
    final rutMatch = rutRegex.firstMatch(text);
    
    // Si no hay RUT, intentar buscar "RUN"
    String? rut;
    if (rutMatch != null) {
      rut = rutMatch.group(0);
    }

    // Buscar Nombre (aprox)
    // Usualmente está cerca de "APELLIDOS" o "NOMBRES" en carnets chilenos
    // Esta es una aproximación simple.
    
    String? name;
    final lines = text.split('\n');
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i].toUpperCase();
      if (line.contains('NOMBRES') && i + 1 < lines.length) {
        name = lines[i + 1].trim(); 
        // A veces añade apellidos después o antes... es complejo sin layout fijo
        // Intentemos capturar 2 lineas si es posible
        if (i + 2 < lines.length && !lines[i+2].contains('NACIONALIDAD')) {
           name = '$name ${lines[i+2].trim()}';
        }
        break;
      }
    }
    
    // Si no encontramos "NOMBRES", quizas es un carnet antiguo o solo tomamos el texto mas largo
    // que no sea el RUT ni "REPUBLICA DE CHILE". 
    // Por ahora, devolvemos lo que tengamos.
    
    if (rut != null) {
      return {
        'rut': _normalizeRut(rut), 
        'name': name ?? '',
      };
    }
    
    return null;
  }
  
  String _normalizeRut(String rawRut) {
    // Eliminar puntos y dejar guion
    return rawRut.replaceAll('.', '').toUpperCase();
  }

  void dispose() => _recognizer.close();
}

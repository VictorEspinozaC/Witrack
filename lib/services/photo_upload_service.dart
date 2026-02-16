import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:path/path.dart' as path;

/// Servicio para subir fotos a Supabase Storage
class PhotoUploadService {
  final _supabase = Supabase.instance.client;
  static const String _bucketName = 'load-photos';

  /// Sube una foto y retorna la URL pública
  /// [file] - Archivo de imagen a subir
  /// [shipmentId] - ID del shipment para organizar en carpetas
  /// [prefix] - Prefijo opcional (ej: 'load', 'incident')
  Future<String?> uploadPhoto(
    File file, 
    int shipmentId, 
    {String prefix = 'photo'}
  ) async {
    try {
      // Generar nombre único
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final extension = path.extension(file.path).toLowerCase();
      final fileName = '${prefix}_$timestamp$extension';
      final storagePath = 'shipment_$shipmentId/$fileName';

      // Subir archivo
      await _supabase.storage
          .from(_bucketName)
          .upload(storagePath, file);

      // Obtener URL pública
      final publicUrl = _supabase.storage
          .from(_bucketName)
          .getPublicUrl(storagePath);

      return publicUrl;
    } catch (e) {
      print('Error subiendo foto: $e');
      return null;
    }
  }

  /// Sube múltiples fotos
  Future<List<String>> uploadPhotos(
    List<File> files, 
    int shipmentId,
    {String prefix = 'photo'}
  ) async {
    final urls = <String>[];
    
    for (final file in files) {
      final url = await uploadPhoto(file, shipmentId, prefix: prefix);
      if (url != null) {
        urls.add(url);
      }
    }
    
    return urls;
  }

  /// Elimina una foto del storage
  Future<bool> deletePhoto(String url) async {
    try {
      // Extraer path del URL
      final uri = Uri.parse(url);
      final segments = uri.pathSegments;
      
      // El path viene después de '/object/public/load-photos/'
      final bucketIndex = segments.indexOf(_bucketName);
      if (bucketIndex == -1 || bucketIndex >= segments.length - 1) {
        return false;
      }
      
      final storagePath = segments.sublist(bucketIndex + 1).join('/');
      
      await _supabase.storage
          .from(_bucketName)
          .remove([storagePath]);
          
      return true;
    } catch (e) {
      print('Error eliminando foto: $e');
      return false;
    }
  }

  /// Sube foto de incidencia
  Future<String?> uploadIncidentPhoto(File file, int incidentId) async {
    try {
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final extension = path.extension(file.path).toLowerCase();
      final fileName = 'incident_${incidentId}_$timestamp$extension';
      final storagePath = 'incidents/$fileName';

      await _supabase.storage
          .from(_bucketName)
          .upload(storagePath, file);

      return _supabase.storage
          .from(_bucketName)
          .getPublicUrl(storagePath);
    } catch (e) {
      print('Error subiendo foto de incidencia: $e');
      return null;
    }
  }
}

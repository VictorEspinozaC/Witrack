import 'package:geolocator/geolocator.dart';
import '../db/app_database.dart';

class GpsService {
  final _db = AppDatabase.instance;

  /// Verifica permisos de GPS
  Future<bool> checkPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  /// Obtiene la ubicación actual
  Future<Position?> getCurrentLocation() async {
    try {
      if (!await checkPermissions()) return null;
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
    } catch (e) {
      print('Error obteniendo ubicación: $e');
      return null;
    }
  }

  /// Registra un evento de despacho con ubicación GPS
  Future<void> dispatchWithLocation(String shipmentId) async {
    // Intentar obtener ubicación (no bloqueante si falla)
    final position = await getCurrentLocation();
    
    // Registrar despacho
    await _db.dispatchShipment(shipmentId);

    // Si hay ubicación, actualizarla
    if (position != null) {
      await _db.updateShipmentLocation(
        shipmentId,
        position.latitude,
        position.longitude,
      );
    }
  }
}

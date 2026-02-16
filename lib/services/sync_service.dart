import 'dart:io';
import '../db/app_database.dart';
import 'photo_upload_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Estado de sincronizacion de una entidad
enum SyncStatus {
  synced,   // 0: Sincronizado con la nube
  created,  // 1: Creado localmente, pendiente de subir
  updated,  // 2: Modificado localmente, pendiente de actualizar
  deleted   // 3: Eliminado localmente, pendiente de borrar en nube
}

class SyncService {
  // Singleton
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  final _db = AppDatabase.instance;
  final _client = Supabase.instance.client;
  final _photoService = PhotoUploadService();

  bool _isSyncing = false;
  DateTime? _lastSyncTime;

  bool get isSyncing => _isSyncing;
  DateTime? get lastSyncTime => _lastSyncTime;

  /// Sincroniza todos los datos (Push local->nube y Pull nube->local)
  Future<void> syncAll() async {
    if (_isSyncing) {
      print('Sync: Ya hay una sincronizacion en curso, omitiendo...');
      return;
    }

    _isSyncing = true;

    try {
      // Validar conexion
      final isConnected = await _checkConnection();
      if (!isConnected) {
        print('Sync: Sin conexion a Supabase, omitiendo...');
        return;
      }

      print('Sync: Iniciando sincronizacion...');

      // ========== PUSH (local -> nube) ==========
      // 1. Maestros primero (sin dependencias FK)
      await _pushTable('trucks', 'plate');
      await _pushTable('drivers', 'rut');
      await _pushTable('branches', 'code');

      // 2. Schedules (depende de branches y trucks)
      await _pushSchedules();

      // 3. Shipments (depende de trucks, drivers, branches)
      await _pushShipments();

      // 4. Load photos (depende de shipments, necesita subir archivo)
      await _pushLoadPhotos();

      // 5. Incidents (depende de shipments)
      await _pushIncidents();

      // ========== PULL (nube -> local) ==========
      await _pullBranches();
      await _pullTrucks();
      await _pullDrivers();
      await _pullShipments();

      _lastSyncTime = DateTime.now();
      print('Sync: Sincronizacion completada');
    } catch (e) {
      print('Sync: Error de sincronizacion: $e');
    } finally {
      _isSyncing = false;
    }
  }

  /// Verifica conexion con Supabase
  Future<bool> _checkConnection() async {
    try {
      final session = _client.auth.currentSession;
      if (session == null) {
        print('Sync: No hay sesion activa');
        return false;
      }
      // Verificar conectividad con una query simple
      await _client.from('branches').select('id').limit(1);
      return true;
    } catch (e) {
      print('Sync: Error de conexion: $e');
      return false;
    }
  }

  // ================================================================
  // PUSH: Local -> Supabase
  // ================================================================

  /// Push generico para tablas maestras (trucks, drivers, branches)
  Future<void> _pushTable(String tableName, String uniqueField) async {
    final db = await _db.db;

    final pending = await db.query(
      tableName,
      where: 'sync_status IN (1, 2)',
    );

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];

        // Limpiar campos locales
        data.remove('id');
        data.remove('sync_status');
        data.remove('last_updated');
        data.remove('remote_id');

        final response = await _client
            .from(tableName)
            .upsert(data, onConflict: uniqueField)
            .select()
            .maybeSingle();

        if (response != null) {
          await db.update(
            tableName,
            {
              'sync_status': 0,
              'remote_id': response['id'].toString(),
              'last_updated': DateTime.now().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [localId],
          );
          print('Push: $tableName subido: ${data[uniqueField]}');
        }
      } catch (e) {
        print('Push: Error subiendo $tableName: $e');
      }
    }
  }

  /// Push de schedules (necesita resolver FKs de branch y truck)
  Future<void> _pushSchedules() async {
    final db = await _db.db;
    final pending = await db.query('schedules', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];

        final branchRemoteId = await _getRemoteId('branches', data['branch_id']);
        if (branchRemoteId == null) {
          print('Push: Schedule $localId pospuesto: falta branch remoto');
          continue;
        }

        int? truckRemoteId;
        if (data['truck_id'] != null) {
          truckRemoteId = await _getRemoteId('trucks', data['truck_id']);
          if (truckRemoteId == null) {
            print('Push: Schedule $localId pospuesto: falta truck remoto');
            continue;
          }
        }

        final supabaseData = <String, dynamic>{
          'branch_id': branchRemoteId,
          'scheduled_date': data['scheduled_date'],
          'truck_id': truckRemoteId,
          'status': data['status'],
          'notes': data['notes'],
        };

        dynamic response;
        if (data['remote_id'] != null) {
          supabaseData['id'] = int.parse(data['remote_id']);
          response = await _client
              .from('schedules')
              .upsert(supabaseData)
              .select()
              .maybeSingle();
        } else {
          response = await _client
              .from('schedules')
              .insert(supabaseData)
              .select()
              .maybeSingle();
        }

        if (response != null) {
          await db.update(
            'schedules',
            {
              'sync_status': 0,
              'remote_id': response['id'].toString(),
              'last_updated': DateTime.now().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [localId],
          );
          print('Push: Schedule subido: $localId -> Cloud ${response['id']}');
        }
      } catch (e) {
        print('Push: Error sync schedule: $e');
      }
    }
  }

  /// Push de shipments (necesita resolver FKs)
  Future<void> _pushShipments() async {
    final db = await _db.db;
    final pending = await db.query('shipments', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];

        final truckRemoteId = await _getRemoteId('trucks', data['truck_id']);
        final driverRemoteId = await _getRemoteId('drivers', data['driver_id']);
        final branchRemoteId = await _getRemoteId('branches', data['branch_id']);

        if (truckRemoteId == null || driverRemoteId == null || branchRemoteId == null) {
          print('Push: Shipment $localId pospuesto: faltan IDs remotos de dependencias');
          continue;
        }

        final supabaseData = <String, dynamic>{
          'truck_id': truckRemoteId,
          'driver_id': driverRemoteId,
          'branch_id': branchRemoteId,
          'status': data['status'],
          'arrival_time': data['arrival_time'],
          'load_start': data['load_start'],
          'load_end': data['load_end'],
          'dispatch_time': data['dispatch_time'],
          'reception_time': data['reception_time'],
          'latitude': data['latitude'],
          'longitude': data['longitude'],
          'notes': data['notes'],
          'created_at': data['created_at'],
        };

        dynamic response;
        if (data['remote_id'] != null) {
          supabaseData['id'] = int.parse(data['remote_id']);
          response = await _client
              .from('shipments')
              .upsert(supabaseData)
              .select()
              .maybeSingle();
        } else {
          response = await _client
              .from('shipments')
              .insert(supabaseData)
              .select()
              .maybeSingle();
        }

        if (response != null) {
          await db.update(
            'shipments',
            {
              'sync_status': 0,
              'remote_id': response['id'].toString(),
              'last_updated': DateTime.now().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [localId],
          );
          print('Push: Shipment subido: $localId -> Cloud ${response['id']}');
        }
      } catch (e) {
        print('Push: Error sync shipment: $e');
      }
    }
  }

  /// Push de fotos de carga (sube archivo a storage + registro a BD)
  Future<void> _pushLoadPhotos() async {
    final db = await _db.db;
    final pending = await db.query('load_photos', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];

        final shipmentRemoteId = await _getRemoteId('shipments', data['shipment_id']);
        if (shipmentRemoteId == null) {
          print('Push: LoadPhoto $localId pospuesto: falta shipment remoto');
          continue;
        }

        // Subir foto a Storage si es ruta local (no URL)
        String? imageUrl = data['image_url'] as String?;
        final localPath = data['path'] as String;

        if (imageUrl == null || imageUrl.isEmpty) {
          final file = File(localPath);
          if (await file.exists()) {
            imageUrl = await _photoService.uploadPhoto(file, shipmentRemoteId);
            if (imageUrl == null) {
              print('Push: LoadPhoto $localId - error subiendo foto a storage');
              continue;
            }
          } else {
            print('Push: LoadPhoto $localId - archivo local no existe: $localPath');
            continue;
          }
        }

        final supabaseData = <String, dynamic>{
          'shipment_id': shipmentRemoteId,
          'image_url': imageUrl,
          'comment': data['comment'],
        };

        dynamic response;
        if (data['remote_id'] != null) {
          supabaseData['id'] = int.parse(data['remote_id']);
          response = await _client
              .from('load_photos')
              .upsert(supabaseData)
              .select()
              .maybeSingle();
        } else {
          response = await _client
              .from('load_photos')
              .insert(supabaseData)
              .select()
              .maybeSingle();
        }

        if (response != null) {
          await db.update(
            'load_photos',
            {
              'sync_status': 0,
              'image_url': imageUrl,
              'remote_id': response['id'].toString(),
              'last_updated': DateTime.now().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [localId],
          );
          print('Push: LoadPhoto subida: $localId -> Cloud ${response['id']}');
        }
      } catch (e) {
        print('Push: Error sync load_photo: $e');
      }
    }
  }

  /// Push de incidencias (con foto a storage si aplica)
  Future<void> _pushIncidents() async {
    final db = await _db.db;
    final pending = await db.query('incidents', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];

        final shipmentRemoteId = await _getRemoteId('shipments', data['shipment_id']);
        if (shipmentRemoteId == null) {
          print('Push: Incident $localId pospuesto: falta shipment remoto');
          continue;
        }

        // Subir foto si hay ruta local y no tiene URL
        String? photoUrl = data['photo_url'] as String?;
        final localPhotoPath = data['photo_path'] as String?;

        if ((photoUrl == null || photoUrl.isEmpty) &&
            localPhotoPath != null &&
            localPhotoPath.isNotEmpty) {
          final file = File(localPhotoPath);
          if (await file.exists()) {
            photoUrl = await _photoService.uploadIncidentPhoto(file, localId);
          }
        }

        // Convertir status local (enProceso) a formato Supabase (en_proceso)
        String supabaseStatus = data['status'] as String;
        if (supabaseStatus == 'enProceso') supabaseStatus = 'en_proceso';

        final supabaseData = <String, dynamic>{
          'shipment_id': shipmentRemoteId,
          'type': data['type'],
          'description': data['description'],
          'photo_url': photoUrl,
          'status': supabaseStatus,
          'resolution': data['resolution'],
          'reported_by': data['reported_by'],
          'created_at': data['created_at'],
          'resolved_at': data['resolved_at'],
        };

        dynamic response;
        if (data['remote_id'] != null) {
          supabaseData['id'] = int.parse(data['remote_id']);
          response = await _client
              .from('incidents')
              .upsert(supabaseData)
              .select()
              .maybeSingle();
        } else {
          response = await _client
              .from('incidents')
              .insert(supabaseData)
              .select()
              .maybeSingle();
        }

        if (response != null) {
          await db.update(
            'incidents',
            {
              'sync_status': 0,
              'photo_url': photoUrl,
              'remote_id': response['id'].toString(),
              'last_updated': DateTime.now().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [localId],
          );
          print('Push: Incident subido: $localId -> Cloud ${response['id']}');
        }
      } catch (e) {
        print('Push: Error sync incident: $e');
      }
    }
  }

  // ================================================================
  // PULL: Supabase -> Local
  // ================================================================

  /// Pull de branches (descargar nuevas/actualizadas desde la nube)
  Future<void> _pullBranches() async {
    try {
      final db = await _db.db;
      final remoteRows = await _client.from('branches').select();

      for (final remote in remoteRows) {
        final remoteId = remote['id'].toString();

        // Buscar si ya existe localmente por remote_id
        final existing = await db.query(
          'branches',
          where: 'remote_id = ?',
          whereArgs: [remoteId],
        );

        if (existing.isEmpty) {
          // Buscar por code (puede haberse creado localmente sin remote_id)
          final byCode = await db.query(
            'branches',
            where: 'code = ?',
            whereArgs: [remote['code']],
          );

          if (byCode.isEmpty) {
            // Nuevo: insertar
            await db.insert('branches', {
              'name': remote['name'],
              'code': remote['code'],
              'remote_id': remoteId,
              'sync_status': 0,
              'last_updated': DateTime.now().toIso8601String(),
            });
            print('Pull: Branch nueva descargada: ${remote['code']}');
          } else {
            // Existe por code: vincular remote_id
            await db.update(
              'branches',
              {
                'remote_id': remoteId,
                'sync_status': 0,
                'last_updated': DateTime.now().toIso8601String(),
              },
              where: 'code = ?',
              whereArgs: [remote['code']],
            );
          }
        }
        // Si ya existe con remote_id, no sobreescribir (local tiene prioridad)
      }
    } catch (e) {
      print('Pull: Error descargando branches: $e');
    }
  }

  /// Pull de trucks
  Future<void> _pullTrucks() async {
    try {
      final db = await _db.db;
      final remoteRows = await _client.from('trucks').select();

      for (final remote in remoteRows) {
        final remoteId = remote['id'].toString();

        final existing = await db.query(
          'trucks',
          where: 'remote_id = ?',
          whereArgs: [remoteId],
        );

        if (existing.isEmpty) {
          final byPlate = await db.query(
            'trucks',
            where: 'plate = ?',
            whereArgs: [remote['plate']],
          );

          if (byPlate.isEmpty) {
            await db.insert('trucks', {
              'plate': remote['plate'],
              'type': remote['type'],
              'remote_id': remoteId,
              'sync_status': 0,
              'last_updated': DateTime.now().toIso8601String(),
            });
            print('Pull: Truck nuevo descargado: ${remote['plate']}');
          } else {
            await db.update(
              'trucks',
              {
                'remote_id': remoteId,
                'sync_status': 0,
                'last_updated': DateTime.now().toIso8601String(),
              },
              where: 'plate = ?',
              whereArgs: [remote['plate']],
            );
          }
        }
      }
    } catch (e) {
      print('Pull: Error descargando trucks: $e');
    }
  }

  /// Pull de drivers
  Future<void> _pullDrivers() async {
    try {
      final db = await _db.db;
      final remoteRows = await _client.from('drivers').select();

      for (final remote in remoteRows) {
        final remoteId = remote['id'].toString();

        final existing = await db.query(
          'drivers',
          where: 'remote_id = ?',
          whereArgs: [remoteId],
        );

        if (existing.isEmpty) {
          final byRut = await db.query(
            'drivers',
            where: 'rut = ?',
            whereArgs: [remote['rut']],
          );

          if (byRut.isEmpty) {
            await db.insert('drivers', {
              'name': remote['name'],
              'rut': remote['rut'],
              'phone': remote['phone'],
              'remote_id': remoteId,
              'sync_status': 0,
              'last_updated': DateTime.now().toIso8601String(),
            });
            print('Pull: Driver nuevo descargado: ${remote['rut']}');
          } else {
            await db.update(
              'drivers',
              {
                'remote_id': remoteId,
                'sync_status': 0,
                'last_updated': DateTime.now().toIso8601String(),
              },
              where: 'rut = ?',
              whereArgs: [remote['rut']],
            );
          }
        }
      }
    } catch (e) {
      print('Pull: Error descargando drivers: $e');
    }
  }

  /// Pull de shipments (descarga envios creados desde otras instancias)
  Future<void> _pullShipments() async {
    try {
      final db = await _db.db;
      final remoteRows = await _client
          .from('shipments')
          .select()
          .order('created_at', ascending: false)
          .limit(200);

      for (final remote in remoteRows) {
        final remoteId = remote['id'].toString();

        final existing = await db.query(
          'shipments',
          where: 'remote_id = ?',
          whereArgs: [remoteId],
        );

        if (existing.isEmpty) {
          // Resolver FKs remotas a locales
          final localTruckId = await _getLocalIdByRemoteId(
              'trucks', remote['truck_id'].toString());
          final localDriverId = await _getLocalIdByRemoteId(
              'drivers', remote['driver_id'].toString());
          final localBranchId = await _getLocalIdByRemoteId(
              'branches', remote['branch_id'].toString());

          if (localTruckId == null ||
              localDriverId == null ||
              localBranchId == null) {
            // FKs no encontradas localmente, posponer
            continue;
          }

          await db.insert('shipments', {
            'truck_id': localTruckId,
            'driver_id': localDriverId,
            'branch_id': localBranchId,
            'status': remote['status'],
            'arrival_time': remote['arrival_time'],
            'load_start': remote['load_start'],
            'load_end': remote['load_end'],
            'dispatch_time': remote['dispatch_time'],
            'reception_time': remote['reception_time'],
            'latitude': remote['latitude'],
            'longitude': remote['longitude'],
            'notes': remote['notes'],
            'created_at':
                remote['created_at'] ?? DateTime.now().toIso8601String(),
            'remote_id': remoteId,
            'sync_status': 0,
            'last_updated': DateTime.now().toIso8601String(),
          });
          print('Pull: Shipment nuevo descargado: Cloud $remoteId');
        } else {
          // Existe: actualizar si local esta synced (sin cambios pendientes)
          final localRow = existing.first;
          if (localRow['sync_status'] == 0) {
            await db.update(
              'shipments',
              {
                'status': remote['status'],
                'arrival_time': remote['arrival_time'],
                'load_start': remote['load_start'],
                'load_end': remote['load_end'],
                'dispatch_time': remote['dispatch_time'],
                'reception_time': remote['reception_time'],
                'latitude': remote['latitude'],
                'longitude': remote['longitude'],
                'notes': remote['notes'],
                'last_updated': DateTime.now().toIso8601String(),
              },
              where: 'remote_id = ?',
              whereArgs: [remoteId],
            );
          }
          // Si sync_status != 0, hay cambios locales pendientes: no sobreescribir
        }
      }
    } catch (e) {
      print('Pull: Error descargando shipments: $e');
    }
  }

  // ================================================================
  // HELPERS
  // ================================================================

  /// Obtiene el remote_id de un registro local
  Future<int?> _getRemoteId(String table, dynamic localId) async {
    if (localId == null) return null;
    final db = await _db.db;
    final result = await db.query(
      table,
      columns: ['remote_id'],
      where: 'id = ?',
      whereArgs: [localId],
    );
    if (result.isNotEmpty && result.first['remote_id'] != null) {
      return int.tryParse(result.first['remote_id'] as String);
    }
    return null;
  }

  /// Obtiene el id local de un registro por su remote_id
  Future<int?> _getLocalIdByRemoteId(String table, String remoteId) async {
    final db = await _db.db;
    final result = await db.query(
      table,
      columns: ['id'],
      where: 'remote_id = ?',
      whereArgs: [remoteId],
    );
    if (result.isNotEmpty) {
      return result.first['id'] as int?;
    }
    return null;
  }
}

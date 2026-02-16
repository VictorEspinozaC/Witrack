import '../db/app_database.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Estado de sincronización de una entidad
enum SyncStatus {
  synced,   // 0: Sincronizado con la nube
  created,  // 1: Creado localmente, pendiente de subir
  updated,  // 2: Modificado localmente, pendiente de actualizar
  deleted   // 3: Eliminado localmente, pendiente de borrar en nube
}

class SyncService {
  final _db = AppDatabase.instance;
  final _client = Supabase.instance.client;

  /// Sincroniza todos los datos pendientes (Push & Pull)
  Future<void> syncAll() async {
    try {
      print('🔄 Iniciando sincronización...');
      
      // 1. Maestros (Push)
      await _syncTable('trucks', 'plate');
      await _syncTable('drivers', 'rut');
      await _syncTable('branches', 'code');
      
      // 2. Transaccionales (Push)
      await _syncShipments();
      await _syncIncidents();
      
      // 3. Pull básico (ejemplo con sucursales)
      // await _pullBranches();
      
      print('✅ Sincronización completada');
    } catch (e) {
      print('❌ Error de sincronización: $e');
    }
  }

  Future<void> _syncTable(String tableName, String uniqueField) async {
    final db = await _db.db;
    
    // Buscar pendientes: sync_status 1 (created) o 2 (updated)
    final pending = await db.query(
      tableName,
      where: 'sync_status IN (1, 2)',
    );

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];
        
        // Limpiar campos locales antes de subir
        data.remove('id'); 
        data.remove('sync_status');
        data.remove('last_updated');
        
        // Si ya tiene remote_id, usarlo para update, si no, es insert
        // Supabase upsert maneja esto si configuramos bien las constraints
        // Pero para simplificar, enviamos los datos clave
        
        final response = await _client.from(tableName).upsert(
            data, 
            onConflict: uniqueField
        ).select().single();

        // Actualizar local con remote_id y marcar synced (0)
        await db.update(
          tableName,
          {
            'sync_status': 0, 
            'remote_id': response['id'].toString(),
            'last_updated': DateTime.now().toIso8601String()
          },
          where: 'id = ?',
          whereArgs: [localId],
        );
        print('📤 $tableName subido: ${data[uniqueField]}');
      } catch (e) {
        print('Error subiendo $tableName $row: $e');
      }
    }
  }

  Future<void> _syncShipments() async {
    final db = await _db.db;
    final pending = await db.query('shipments', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
      try {
        final data = Map<String, dynamic>.from(row);
        final localId = data['id'];
        
        // Se requieren los IDs remotos de las foreign keys
        // Si truck_id (local) 5 es truck_id (remote) 100, debemos enviar 100
        // Esto asume que los maestros ya se sincronizaron y tienen remote_id
        
        final truckFn = await _getRemoteId('trucks', data['truck_id']);
        final driverFn = await _getRemoteId('drivers', data['driver_id']);
        final branchFn = await _getRemoteId('branches', data['branch_id']);

        if (truckFn == null || driverFn == null || branchFn == null) {
          print('⚠️ Shipment $localId pospuesto: Faltan IDs remotos de dependencias');
          continue; 
        }

        data['truck_id'] = truckFn;
        data['driver_id'] = driverFn;
        data['branch_id'] = branchFn;

        data.remove('id');
        data.remove('sync_status');
        data.remove('last_updated');

        dynamic response;
        if (data['remote_id'] != null) {
           data['id'] = data['remote_id']; // Usar ID remoto si existe
           response = await _client.from('shipments').upsert(data).select().single();
        } else {
           data.remove('remote_id');
           response = await _client.from('shipments').insert(data).select().single();
        }

        await db.update(
          'shipments',
          {
            'sync_status': 0,
            'remote_id': response['id'].toString(),
            'last_updated': DateTime.now().toIso8601String()
          },
          where: 'id = ?',
          whereArgs: [localId],
        );
        print('📤 Shipment subido: $localId -> Cloud ${response['id']}');

      } catch (e) {
        print('Error sync shipment: $e');
      }
    }
  }

  Future<void> _syncIncidents() async {
    // Sincronizar incidencias... similar a shipments
    // Requiere shipment_remote_id
    final db = await _db.db;
    final pending = await db.query('incidents', where: 'sync_status IN (1, 2)');

    for (final row in pending) {
       final data = Map<String, dynamic>.from(row);
       final localId = data['id'];
       final shipmentFn = await _getRemoteId('shipments', data['shipment_id']);
       
       if (shipmentFn == null) continue;
       
       data['shipment_id'] = shipmentFn;
       data.remove('id');
       data.remove('sync_status');
       data.remove('last_updated');
       
       // Si hay foto local, se debería subir a storage primero... (pendiente)
       // data['photo_url'] = await _uploadPhoto(data['photo_path']);

       if (data['remote_id'] != null) {
           data['id'] = data['remote_id'];
           await _client.from('incidents').upsert(data);
       } else {
           data.remove('remote_id');
           await _client.from('incidents').insert(data);
       }
       
       // Asumimos éxito
       await db.update('incidents', {'sync_status': 0}, where: 'id = ?', whereArgs: [localId]);
    }
  }

  Future<int?> _getRemoteId(String table, int localId) async {
    final db = await _db.db;
    final result = await db.query(table, columns: ['remote_id'], where: 'id = ?', whereArgs: [localId]);
    if (result.isNotEmpty && result.first['remote_id'] != null) {
      return int.tryParse(result.first['remote_id'] as String);
    }
    return null;
  }
}

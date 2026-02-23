import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/models.dart';

/// Base de datos principal de la aplicación
class AppDatabase {
  static final AppDatabase instance = AppDatabase._();
  AppDatabase._();

  Database? _db;
  static const int _version = 4;

  Future<Database> get db async {
    if (_db != null) return _db!;
    // En web se usa un nombre; en móvil/desktop una ruta en el sistema de archivos
    final path = kIsWeb ? 'transporte.db' : join(await getDatabasesPath(), 'transporte.db');

    _db = await openDatabase(
      path,
      version: _version,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );

    return _db!;
  }

  Future<void> _onCreate(Database d, int version) async {
    // Sucursales
    await d.execute('''
      CREATE TABLE branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1, -- 0:synced, 1:created, 2:updated, 3:deleted
        last_updated TEXT
      );
    ''');

    // Choferes
    await d.execute('''
      CREATE TABLE drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rut TEXT UNIQUE NOT NULL,
        phone TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Camiones
    await d.execute('''
      CREATE TABLE trucks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Programaciones
    await d.execute('''
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER NOT NULL REFERENCES branches(id),
        scheduled_date TEXT NOT NULL,
        truck_id INTEGER REFERENCES trucks(id),
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Envíos/Shipments (flujo principal)
    await d.execute('''
      CREATE TABLE shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        truck_id INTEGER NOT NULL REFERENCES trucks(id),
        driver_id INTEGER NOT NULL REFERENCES drivers(id),
        branch_id INTEGER NOT NULL REFERENCES branches(id),
        status TEXT NOT NULL,
        arrival_time TEXT,
        load_start TEXT,
        load_end TEXT,
        dispatch_time TEXT,
        reception_time TEXT,
        latitude REAL,
        longitude REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Fotos de carga
    await d.execute('''
      CREATE TABLE load_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id INTEGER NOT NULL REFERENCES shipments(id),
        path TEXT NOT NULL,
        image_url TEXT,
        comment TEXT,
        created_at TEXT NOT NULL,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Incidencias
    await d.execute('''
      CREATE TABLE incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id INTEGER NOT NULL REFERENCES shipments(id),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        photo_path TEXT,
        photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'abierta',
        resolution TEXT,
        reported_by TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    await _createIndexes(d);
    await _insertInitialData(d);
  }

  Future<void> _createIndexes(Database d) async {
    await d.execute('CREATE INDEX idx_shipments_status ON shipments(status);');
    await d.execute('CREATE INDEX idx_shipments_branch ON shipments(branch_id);');
    await d.execute('CREATE INDEX idx_shipments_sync ON shipments(sync_status);');
    await d.execute('CREATE INDEX idx_trucks_plate ON trucks(plate);');
  }

  Future<void> _onUpgrade(Database d, int oldVersion, int newVersion) async {
    if (oldVersion < 3) {
      // Agregar columnas de sincronizacion a tablas existentes
      final tables = ['branches', 'drivers', 'trucks', 'schedules', 'shipments', 'load_photos', 'incidents'];

      for (final table in tables) {
        try {
          await d.execute('ALTER TABLE $table ADD COLUMN remote_id TEXT UNIQUE');
          await d.execute('ALTER TABLE $table ADD COLUMN sync_status INTEGER DEFAULT 1');
          await d.execute('ALTER TABLE $table ADD COLUMN last_updated TEXT');
        } catch (e) {
          print('Error migrando $table: $e');
        }
      }

      try {
        await d.execute('CREATE INDEX idx_shipments_sync ON shipments(sync_status);');
      } catch (e) {
        print('Error creando indice: $e');
      }
    }

    if (oldVersion < 4) {
      // Agregar columnas para compatibilidad con Supabase
      try {
        await d.execute('ALTER TABLE load_photos ADD COLUMN image_url TEXT');
      } catch (e) {
        print('Columna image_url ya existe en load_photos: $e');
      }
      try {
        await d.execute('ALTER TABLE incidents ADD COLUMN photo_url TEXT');
      } catch (e) {
        print('Columna photo_url ya existe en incidents: $e');
      }
      try {
        await d.execute('ALTER TABLE incidents ADD COLUMN reported_by TEXT');
      } catch (e) {
        print('Columna reported_by ya existe en incidents: $e');
      }
    }
  }

  Future<void> _insertInitialData(Database d) async {
    // Sucursales de ejemplo
    final branches = [
      {'name': 'Sucursal Central', 'code': 'CENTRAL', 'sync_status': 1},
      {'name': 'Sucursal Norte', 'code': 'NORTE', 'sync_status': 1},
      {'name': 'Sucursal Sur', 'code': 'SUR', 'sync_status': 1},
    ];
    for (final b in branches) {
      await d.insert('branches', b);
    }
  }

  // ============ BRANCHES ============

  Future<List<Branch>> getAllBranches() async {
    final d = await db;
    final rows = await d.query('branches', orderBy: 'name');
    return rows.map(Branch.fromMap).toList();
  }

  Future<Branch?> getBranchById(int id) async {
    final d = await db;
    final rows = await d.query('branches', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Branch.fromMap(rows.first);
  }

  Future<int> insertBranch(Branch branch) async {
    final d = await db;
    return d.insert('branches', branch.toMap()..remove('id'));
  }

  Future<int> updateBranch(Branch branch) async {
    final d = await db;
    return d.update(
      'branches',
      branch.toMap(),
      where: 'id = ?',
      whereArgs: [branch.id],
    );
  }

  Future<int> deleteBranch(int id) async {
    final d = await db;
    // Logical delete or physical? For now physical as per requirement, 
    // but usually better to soft delete. Using physical for simplicity 
    // unless constraints fail. 
    // NOTE: Foreign keys might prevent deletion if used in shipments.
    // Let's use physical delete and let SQLite throw error if constraint failed.
    return d.delete('branches', where: 'id = ?', whereArgs: [id]);
  }

  // ============ DRIVERS ============

  Future<List<Driver>> getAllDrivers() async {
    final d = await db;
    final rows = await d.query('drivers', orderBy: 'name');
    return rows.map(Driver.fromMap).toList();
  }

  Future<Driver?> getDriverByRut(String rut) async {
    final d = await db;
    final rows = await d.query('drivers', where: 'rut = ?', whereArgs: [rut]);
    if (rows.isEmpty) return null;
    return Driver.fromMap(rows.first);
  }

  Future<Driver?> getDriverById(int id) async {
    final d = await db;
    final rows = await d.query('drivers', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Driver.fromMap(rows.first);
  }

  Future<int> insertDriver(Driver driver) async {
    final d = await db;
    return d.insert('drivers', driver.toMap()..remove('id'));
  }

  Future<int> updateDriver(Driver driver) async {
    final d = await db;
    return d.update(
      'drivers',
      driver.toMap(),
      where: 'id = ?',
      whereArgs: [driver.id],
    );
  }

  // ============ TRUCKS ============

  Future<List<Truck>> getAllTrucks() async {
    final d = await db;
    final rows = await d.query('trucks', orderBy: 'plate');
    return rows.map(Truck.fromMap).toList();
  }

  Future<Truck?> getTruckByPlate(String plate) async {
    final d = await db;
    final rows = await d.query('trucks', where: 'plate = ?', whereArgs: [plate]);
    if (rows.isEmpty) return null;
    return Truck.fromMap(rows.first);
  }

  Future<Truck?> getTruckById(int id) async {
    final d = await db;
    final rows = await d.query('trucks', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Truck.fromMap(rows.first);
  }

  Future<int> insertTruck(Truck truck) async {
    final d = await db;
    return d.insert('trucks', truck.toMap()..remove('id'));
  }

  /// Inserta o retorna el camión existente por patente
  Future<Truck> getOrCreateTruck(String plate, TruckType type) async {
    var truck = await getTruckByPlate(plate);
    if (truck != null) return truck;

    final id = await insertTruck(Truck(plate: plate, type: type));
    return Truck(id: id, plate: plate, type: type);
  }

  // ============ SCHEDULES ============

  Future<List<Schedule>> getSchedules({ScheduleStatus? status, int? branchId}) async {
    final d = await db;
    String? where;
    List<Object?>? whereArgs;

    if (status != null && branchId != null) {
      where = 'status = ? AND branch_id = ?';
      whereArgs = [status.name, branchId];
    } else if (status != null) {
      where = 'status = ?';
      whereArgs = [status.name];
    } else if (branchId != null) {
      where = 'branch_id = ?';
      whereArgs = [branchId];
    }

    final rows = await d.query(
      'schedules',
      where: where,
      whereArgs: whereArgs,
      orderBy: 'scheduled_date DESC',
    );
    return rows.map(Schedule.fromMap).toList();
  }

  Future<int> insertSchedule(Schedule schedule) async {
    final d = await db;
    return d.insert('schedules', schedule.toMap()..remove('id'));
  }

  Future<int> updateSchedule(Schedule schedule) async {
    final d = await db;
    return d.update(
      'schedules',
      schedule.toMap(),
      where: 'id = ?',
      whereArgs: [schedule.id],
    );
  }

  Future<int> cancelSchedule(int id) async {
    final d = await db;
    return d.update(
      'schedules',
      {'status': ScheduleStatus.cancelled.name},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ============ SHIPMENTS ============

  Future<List<Shipment>> getShipments({
    ShipmentStatus? status,
    int? branchId,
    int limit = 100,
  }) async {
    final d = await db;
    String? where;
    List<Object?>? whereArgs;

    if (status != null && branchId != null) {
      where = 'status = ? AND branch_id = ?';
      whereArgs = [status.name, branchId];
    } else if (status != null) {
      where = 'status = ?';
      whereArgs = [status.name];
    } else if (branchId != null) {
      where = 'branch_id = ?';
      whereArgs = [branchId];
    }

    final rows = await d.query(
      'shipments',
      where: where,
      whereArgs: whereArgs,
      orderBy: 'created_at DESC',
      limit: limit,
    );
    return rows.map(Shipment.fromMap).toList();
  }

  /// Obtiene shipments activos (no recibidos ni resueltos)
  Future<List<Shipment>> getActiveShipments({int? branchId}) async {
    final d = await db;
    final activeStatuses = [
      ShipmentStatus.esperaIngreso,
      ShipmentStatus.enEspera,
      ShipmentStatus.enCarga,
      ShipmentStatus.cargado,
      ShipmentStatus.despachado,
      ShipmentStatus.incidencia,
    ].map((s) => "'${s.name}'").join(',');

    String where = 'status IN ($activeStatuses)';
    List<Object?>? whereArgs;

    if (branchId != null) {
      where += ' AND branch_id = ?';
      whereArgs = [branchId];
    }

    final rows = await d.rawQuery('''
      SELECT * FROM shipments 
      WHERE $where
      ORDER BY created_at DESC
    ''', whereArgs);

    return rows.map(Shipment.fromMap).toList();
  }

  Future<Shipment?> getShipmentById(int id) async {
    final d = await db;
    final rows = await d.query('shipments', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Shipment.fromMap(rows.first);
  }

  Future<int> insertShipment(Shipment shipment) async {
    final d = await db;
    return d.insert('shipments', shipment.toMap()..remove('id'));
  }

  Future<int> updateShipment(Shipment shipment) async {
    final d = await db;
    return d.update(
      'shipments',
      shipment.toMap(),
      where: 'id = ?',
      whereArgs: [shipment.id],
    );
  }

  /// Actualiza el estado de un shipment
  Future<int> updateShipmentStatus(int id, ShipmentStatus status) async {
    final d = await db;
    return d.update(
      'shipments',
      {'status': status.name, 'sync_status': 2},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Inicia la carga de un shipment
  Future<int> startLoad(int shipmentId, {DateTime? time}) async {
    final d = await db;
    return d.update(
      'shipments',
      {
        'status': ShipmentStatus.enCarga.name,
        'load_start': (time ?? DateTime.now()).toIso8601String(),
        'sync_status': 2,
      },
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  /// Finaliza la carga de un shipment
  Future<int> endLoad(int shipmentId, {DateTime? time}) async {
    final d = await db;
    return d.update(
      'shipments',
      {
        'status': ShipmentStatus.cargado.name,
        'load_end': (time ?? DateTime.now()).toIso8601String(),
        'sync_status': 2,
      },
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  /// Despacha un shipment
  Future<int> dispatchShipment(int shipmentId, {DateTime? time}) async {
    final d = await db;
    return d.update(
      'shipments',
      {
        'status': ShipmentStatus.despachado.name,
        'dispatch_time': (time ?? DateTime.now()).toIso8601String(),
        'sync_status': 2,
      },
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  /// Recibe un shipment en sucursal
  Future<int> receiveShipment(int shipmentId, {DateTime? time}) async {
    final d = await db;
    return d.update(
      'shipments',
      {
        'status': ShipmentStatus.recibido.name,
        'reception_time': (time ?? DateTime.now()).toIso8601String(),
        'sync_status': 2,
      },
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  /// Actualiza ubicación GPS de un shipment
  Future<int> updateShipmentLocation(int shipmentId, double lat, double lng) async {
    final d = await db;
    return d.update(
      'shipments',
      {'latitude': lat, 'longitude': lng, 'sync_status': 2},
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  // ============ LOAD PHOTOS ============

  Future<List<LoadPhoto>> getPhotosForShipment(int shipmentId) async {
    final d = await db;
    final rows = await d.query(
      'load_photos',
      where: 'shipment_id = ?',
      whereArgs: [shipmentId],
      orderBy: 'created_at DESC',
    );
    return rows.map(LoadPhoto.fromMap).toList();
  }

  Future<int> insertLoadPhoto(LoadPhoto photo) async {
    final d = await db;
    return d.insert('load_photos', photo.toMap()..remove('id'));
  }

  Future<int> deleteLoadPhoto(int id) async {
    final d = await db;
    return d.delete('load_photos', where: 'id = ?', whereArgs: [id]);
  }

  // ============ INCIDENTS ============

  Future<List<Incident>> getIncidentsForShipment(int shipmentId) async {
    final d = await db;
    final rows = await d.query(
      'incidents',
      where: 'shipment_id = ?',
      whereArgs: [shipmentId],
      orderBy: 'created_at DESC',
    );
    return rows.map(Incident.fromMap).toList();
  }

  Future<List<Incident>> getOpenIncidents() async {
    final d = await db;
    final rows = await d.query(
      'incidents',
      where: 'status != ?',
      whereArgs: [IncidentStatus.resuelta.name],
      orderBy: 'created_at DESC',
    );
    return rows.map(Incident.fromMap).toList();
  }

  Future<int> insertIncident(Incident incident) async {
    final d = await db;
    // También actualizar el estado del shipment
    await updateShipmentStatus(incident.shipmentId, ShipmentStatus.incidencia);
    return d.insert('incidents', incident.toMap()..remove('id'));
  }

  Future<int> resolveIncident(int id, String resolution) async {
    final d = await db;
    return d.update(
      'incidents',
      {
        'status': IncidentStatus.resuelta.name,
        'resolution': resolution,
        'resolved_at': DateTime.now().toIso8601String(),
        'sync_status': 2,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ============ UTILITIES ============

  /// Cierra la base de datos
  Future<void> close() async {
    final d = await db;
    await d.close();
    _db = null;
  }

  /// Reinicia la base de datos (solo para desarrollo)
  Future<void> reset() async {
    final dbPath = join(await getDatabasesPath(), 'transporte.db');
    await deleteDatabase(dbPath);
    _db = null;
  }
}

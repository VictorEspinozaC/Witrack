import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';
import '../models/models.dart';

/// Base de datos principal de la aplicación
class AppDatabase {
  static final AppDatabase instance = AppDatabase._();
  AppDatabase._();

  Database? _db;
  static const int _version = 7;
  static const _uuid = Uuid();

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
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1, -- 0:synced, 1:created, 2:updated, 3:deleted
        last_updated TEXT
      );
    ''');

    // Empresas de Transporte
    await d.execute('''
      CREATE TABLE transport_companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rut TEXT UNIQUE NOT NULL,
        billing_address TEXT,
        zip_code TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Contactos (Polimórfico)
    await d.execute('''
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        type TEXT NOT NULL, -- transporter, client, supplier
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Clientes
    await d.execute('''
      CREATE TABLE clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rut TEXT UNIQUE NOT NULL,
        billing_address TEXT,
        zip_code TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Direcciones de Despacho
    await d.execute('''
      CREATE TABLE dispatch_addresses (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(id),
        address TEXT NOT NULL,
        zip_code TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Proveedores
    await d.execute('''
      CREATE TABLE suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        zip_code TEXT,
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Choferes
    await d.execute('''
      CREATE TABLE drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rut TEXT UNIQUE NOT NULL,
        phone TEXT,
        birth_date TEXT,
        license_expiry_date TEXT,
        transport_company_id TEXT REFERENCES transport_companies(id),
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Camiones
    await d.execute('''
      CREATE TABLE trucks (
        id TEXT PRIMARY KEY,
        plate TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        classification TEXT, -- branchLoad, supplierUnload, maquila
        transport_company_id TEXT REFERENCES transport_companies(id),
        remote_id TEXT UNIQUE,
        sync_status INTEGER DEFAULT 1,
        last_updated TEXT
      );
    ''');

    // Programaciones
    await d.execute('''
      CREATE TABLE schedules (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        scheduled_date TEXT NOT NULL,
        truck_id TEXT REFERENCES trucks(id),
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
        id TEXT PRIMARY KEY,
        truck_id TEXT NOT NULL REFERENCES trucks(id),
        driver_id TEXT NOT NULL REFERENCES drivers(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        transport_company_id TEXT REFERENCES transport_companies(id),
        client_id TEXT REFERENCES clients(id),
        supplier_id TEXT REFERENCES suppliers(id),
        dispatch_address_id TEXT REFERENCES dispatch_addresses(id),
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
        id TEXT PRIMARY KEY,
        shipment_id TEXT NOT NULL REFERENCES shipments(id),
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
        id TEXT PRIMARY KEY,
        shipment_id TEXT NOT NULL REFERENCES shipments(id),
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

    if (oldVersion < 7) {
      // Nuevas tablas
      await d.execute('''
        CREATE TABLE transport_companies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          rut TEXT UNIQUE NOT NULL,
          billing_address TEXT,
          zip_code TEXT,
          remote_id TEXT UNIQUE,
          sync_status INTEGER DEFAULT 1,
          last_updated TEXT
        )
      ''');
      await d.execute('''
        CREATE TABLE contacts (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          remote_id TEXT UNIQUE,
          sync_status INTEGER DEFAULT 1,
          last_updated TEXT
        )
      ''');
      await d.execute('''
        CREATE TABLE clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          rut TEXT UNIQUE NOT NULL,
          billing_address TEXT,
          zip_code TEXT,
          remote_id TEXT UNIQUE,
          sync_status INTEGER DEFAULT 1,
          last_updated TEXT
        )
      ''');
      await d.execute('''
        CREATE TABLE dispatch_addresses (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL REFERENCES clients(id),
          address TEXT NOT NULL,
          zip_code TEXT,
          remote_id TEXT UNIQUE,
          sync_status INTEGER DEFAULT 1,
          last_updated TEXT
        )
      ''');
      await d.execute('''
        CREATE TABLE suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          zip_code TEXT,
          remote_id TEXT UNIQUE,
          sync_status INTEGER DEFAULT 1,
          last_updated TEXT
        )
      ''');

      // Modificar tablas existentes
      try {
        await d.execute('ALTER TABLE drivers ADD COLUMN transport_company_id TEXT REFERENCES transport_companies(id)');
      } catch (e) {
        print('Error alter drivers: $e');
      }
      try {
        await d.execute('ALTER TABLE trucks ADD COLUMN classification TEXT');
        await d.execute('ALTER TABLE trucks ADD COLUMN transport_company_id TEXT REFERENCES transport_companies(id)');
      } catch (e) {
        print('Error alter trucks: $e');
      }
      try {
        await d.execute('ALTER TABLE shipments ADD COLUMN transport_company_id TEXT REFERENCES transport_companies(id)');
        await d.execute('ALTER TABLE shipments ADD COLUMN client_id TEXT REFERENCES clients(id)');
        await d.execute('ALTER TABLE shipments ADD COLUMN supplier_id TEXT REFERENCES suppliers(id)');
        await d.execute('ALTER TABLE shipments ADD COLUMN dispatch_address_id TEXT REFERENCES dispatch_addresses(id)');
      } catch (e) {
        print('Error alter shipments: $e');
      }
    }
  }

  Future<void> _insertInitialData(Database d) async {
    // Sucursales de ejemplo
    final branches = [
      {'id': _uuid.v4(), 'name': 'Sucursal Central', 'code': 'CENTRAL', 'sync_status': 1},
      {'id': _uuid.v4(), 'name': 'Sucursal Norte', 'code': 'NORTE', 'sync_status': 1},
      {'id': _uuid.v4(), 'name': 'Sucursal Sur', 'code': 'SUR', 'sync_status': 1},
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

  Future<Branch?> getBranchById(String id) async {
    final d = await db;
    final rows = await d.query('branches', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Branch.fromMap(rows.first);
  }

  Future<String> insertBranch(Branch branch) async {
    final d = await db;
    final id = branch.id ?? _uuid.v4();
    final data = branch.toMap();
    data['id'] = id;
    await d.insert('branches', data);
    return id;
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

  Future<int> deleteBranch(String id) async {
    final d = await db;
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

  Future<Driver?> getDriverById(String id) async {
    final d = await db;
    final rows = await d.query('drivers', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Driver.fromMap(rows.first);
  }

  Future<String> insertDriver(Driver driver) async {
    final d = await db;
    final id = driver.id ?? _uuid.v4();
    final data = driver.toMap();
    data['id'] = id;
    await d.insert('drivers', data);
    return id;
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

  Future<Truck?> getTruckById(String id) async {
    final d = await db;
    final rows = await d.query('trucks', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Truck.fromMap(rows.first);
  }

  Future<String> insertTruck(Truck truck) async {
    final d = await db;
    final id = truck.id ?? _uuid.v4();
    final data = truck.toMap();
    data['id'] = id;
    await d.insert('trucks', data);
    return id;
  }

  Future<int> updateTruck(Truck truck) async {
    final d = await db;
    return d.update(
      'trucks',
      truck.toMap(),
      where: 'id = ?',
      whereArgs: [truck.id],
    );
  }

  /// Inserta o retorna el camión existente por patente
  Future<Truck> getOrCreateTruck(String plate, TruckType type) async {
    var truck = await getTruckByPlate(plate);
    if (truck != null) return truck;

    final id = await insertTruck(Truck(plate: plate, type: type));
    return Truck(id: id, plate: plate, type: type);
  }

  // ============ SCHEDULES ============

  Future<List<Schedule>> getSchedules({ScheduleStatus? status, String? branchId}) async {
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

  Future<String> insertSchedule(Schedule schedule) async {
    final d = await db;
    final id = schedule.id ?? _uuid.v4();
    final data = schedule.toMap();
    data['id'] = id;
    await d.insert('schedules', data);
    return id;
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

  Future<int> cancelSchedule(String id) async {
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
    String? branchId,
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
  Future<List<Shipment>> getActiveShipments({String? branchId, String? clientId}) async {
    final d = await db;
    final activeStatuses = [
      ShipmentStatus.esperaIngreso,
      ShipmentStatus.enEspera,
      ShipmentStatus.enCarga,
      ShipmentStatus.cargado,
      ShipmentStatus.amarre,
      ShipmentStatus.despachado,
      ShipmentStatus.incidencia,
    ].map((s) => "'${s.name}'").join(',');

    String where = 'status IN ($activeStatuses)';
    List<Object?>? whereArgs;

    if (branchId != null) {
      where += ' AND branch_id = ?';
      whereArgs = (whereArgs ?? [])..add(branchId);
    }
    
    if (clientId != null) {
      where += ' AND client_id = ?';
      whereArgs = (whereArgs ?? [])..add(clientId);
    }

    final rows = await d.rawQuery('''
      SELECT * FROM shipments 
      WHERE $where
      ORDER BY created_at DESC
    ''', whereArgs);

    return rows.map(Shipment.fromMap).toList();
  }

  Future<Shipment?> getShipmentById(String id) async {
    final d = await db;
    final rows = await d.query('shipments', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return Shipment.fromMap(rows.first);
  }

  Future<String> insertShipment(Shipment shipment) async {
    final d = await db;
    final id = shipment.id ?? _uuid.v4();
    final data = shipment.toMap();
    data['id'] = id;
    await d.insert('shipments', data);
    return id;
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
  Future<int> updateShipmentStatus(String id, ShipmentStatus status) async {
    final d = await db;
    return d.update(
      'shipments',
      {'status': status.name, 'sync_status': 2},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Inicia la carga de un shipment
  Future<int> startLoad(String shipmentId, {DateTime? time}) async {
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
  Future<int> endLoad(String shipmentId, {DateTime? time}) async {
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
  Future<int> dispatchShipment(String shipmentId, {DateTime? time}) async {
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
  Future<int> receiveShipment(String shipmentId, {DateTime? time}) async {
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
  Future<int> updateShipmentLocation(String shipmentId, double lat, double lng) async {
    final d = await db;
    return d.update(
      'shipments',
      {'latitude': lat, 'longitude': lng, 'sync_status': 2},
      where: 'id = ?',
      whereArgs: [shipmentId],
    );
  }

  // ============ LOAD PHOTOS ============

  Future<List<LoadPhoto>> getPhotosForShipment(String shipmentId) async {
    final d = await db;
    final rows = await d.query(
      'load_photos',
      where: 'shipment_id = ?',
      whereArgs: [shipmentId],
      orderBy: 'created_at DESC',
    );
    return rows.map(LoadPhoto.fromMap).toList();
  }

  Future<String> insertLoadPhoto(LoadPhoto photo) async {
    final d = await db;
    final id = photo.id ?? _uuid.v4();
    final data = photo.toMap();
    data['id'] = id;
    await d.insert('load_photos', data);
    return id;
  }

  Future<int> deleteLoadPhoto(String id) async {
    final d = await db;
    return d.delete('load_photos', where: 'id = ?', whereArgs: [id]);
  }

  // ============ INCIDENTS ============

  Future<List<Incident>> getIncidentsForShipment(String shipmentId) async {
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

  Future<String> insertIncident(Incident incident) async {
    final d = await db;
    // También actualizar el estado del shipment
    await updateShipmentStatus(incident.shipmentId, ShipmentStatus.incidencia);
    final id = incident.id ?? _uuid.v4();
    final data = incident.toMap();
    data['id'] = id;
    await d.insert('incidents', data);
    return id;
  }

  Future<int> resolveIncident(String id, String resolution) async {
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

  // ============ TRANSPORT COMPANIES ============

  Future<List<TransportCompany>> getAllTransportCompanies() async {
    final d = await db;
    final rows = await d.query('transport_companies', orderBy: 'name');
    return rows.map(TransportCompany.fromMap).toList();
  }

  Future<String> insertTransportCompany(TransportCompany company) async {
    final d = await db;
    final id = company.id ?? _uuid.v4();
    final data = company.toMap();
    data['id'] = id;
    await d.insert('transport_companies', data);
    return id;
  }

  Future<int> updateTransportCompany(TransportCompany company) async {
    final d = await db;
    return d.update(
      'transport_companies',
      company.toMap(),
      where: 'id = ?',
      whereArgs: [company.id],
    );
  }

  // ============ CLIENTS ============

  Future<List<Client>> getAllClients() async {
    final d = await db;
    final rows = await d.query('clients', orderBy: 'name');
    return rows.map(Client.fromMap).toList();
  }

  Future<String> insertClient(Client client) async {
    final d = await db;
    final id = client.id ?? _uuid.v4();
    final data = client.toMap();
    data['id'] = id;
    await d.insert('clients', data);
    return id;
  }

  Future<int> updateClient(Client client) async {
    final d = await db;
    return d.update(
      'clients',
      client.toMap(),
      where: 'id = ?',
      whereArgs: [client.id],
    );
  }

  // ============ DISPATCH ADDRESSES ============

  Future<List<DispatchAddress>> getDispatchAddresses(String clientId) async {
    final d = await db;
    final rows = await d.query(
      'dispatch_addresses',
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
    return rows.map(DispatchAddress.fromMap).toList();
  }

  Future<String> insertDispatchAddress(DispatchAddress address) async {
    final d = await db;
    final id = address.id ?? _uuid.v4();
    final data = address.toMap();
    data['id'] = id;
    await d.insert('dispatch_addresses', data);
    return id;
  }

  // ============ SUPPLIERS ============

  Future<List<Supplier>> getAllSuppliers() async {
    final d = await db;
    final rows = await d.query('suppliers', orderBy: 'name');
    return rows.map(Supplier.fromMap).toList();
  }

  Future<String> insertSupplier(Supplier supplier) async {
    final d = await db;
    final id = supplier.id ?? _uuid.v4();
    final data = supplier.toMap();
    data['id'] = id;
    await d.insert('suppliers', data);
    return id;
  }

  // ============ CONTACTS ============

  Future<List<Contact>> getContacts(String ownerId, ContactType type) async {
    final d = await db;
    final rows = await d.query(
      'contacts',
      where: 'owner_id = ? AND type = ?',
      whereArgs: [ownerId, type.name],
    );
    return rows.map(Contact.fromMap).toList();
  }

  Future<String> insertContact(Contact contact) async {
    final d = await db;
    final id = contact.id ?? _uuid.v4();
    final data = contact.toMap();
    data['id'] = id;
    await d.insert('contacts', data);
    return id;
  }

  Future<int> deleteContact(String id) async {
    final d = await db;
    return d.delete('contacts', where: 'id = ?', whereArgs: [id]);
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

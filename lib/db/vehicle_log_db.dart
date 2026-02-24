import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

class VehicleLog {
  final String? id;
  final String plate;
  final String? driverName;
  final String? driverRut;
  final DateTime entryTime;
  final DateTime? exitTime;
  final String status; // OPEN / CLOSED

  VehicleLog({
    this.id,
    required this.plate,
    this.driverName,
    this.driverRut,
    required this.entryTime,
    this.exitTime,
    required this.status,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'plate': plate,
    'driver_name': driverName,
    'driver_rut': driverRut,
    'entry_time': entryTime.toIso8601String(),
    'exit_time': exitTime?.toIso8601String(),
    'status': status,
  };

  static VehicleLog fromMap(Map<String, dynamic> m) => VehicleLog(
    id: m['id']?.toString(),
    plate: m['plate'] as String,
    driverName: m['driver_name'] as String?,
    driverRut: m['driver_rut'] as String?,
    entryTime: DateTime.parse(m['entry_time'] as String),
    exitTime: m['exit_time'] == null ? null : DateTime.parse(m['exit_time'] as String),
    status: m['status'] as String,
  );
}

class VehicleLogDb {
  static final VehicleLogDb instance = VehicleLogDb._();
  VehicleLogDb._();

  Database? _db;
  final _uuid = const Uuid();

  Future<Database> get db async {
    if (_db != null) return _db!;
    final path = join(await getDatabasesPath(), 'vehicle_logs.db');

    _db = await openDatabase(
      path,
      version: 2, // Increment version for TEXT ID
      onCreate: (d, _) async {
        await d.execute('''
          CREATE TABLE vehicle_logs(
            id TEXT PRIMARY KEY,
            plate TEXT NOT NULL,
            driver_name TEXT,
            driver_rut TEXT,
            entry_time TEXT NOT NULL,
            exit_time TEXT,
            status TEXT NOT NULL
          );
        ''');
        await d.execute('CREATE INDEX idx_plate_status ON vehicle_logs(plate, status);');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          // Simplest is to drop and recreate for this local log
          await db.execute('DROP TABLE IF EXISTS vehicle_logs');
          await db.execute('''
            CREATE TABLE vehicle_logs(
              id TEXT PRIMARY KEY,
              plate TEXT NOT NULL,
              driver_name TEXT,
              driver_rut TEXT,
              entry_time TEXT NOT NULL,
              exit_time TEXT,
              status TEXT NOT NULL
            );
          ''');
          await db.execute('CREATE INDEX idx_plate_status ON vehicle_logs(plate, status);');
        }
      }
    );

    return _db!;
  }

  Future<String> insertEntry({
    required String plate,
    required String driverName,
    required String driverRut,
  }) async {
    final d = await db;
    final id = _uuid.v4();
    await d.insert('vehicle_logs', {
      'id': id,
      'plate': plate,
      'driver_name': driverName,
      'driver_rut': driverRut,
      'entry_time': DateTime.now().toIso8601String(),
      'exit_time': null,
      'status': 'OPEN',
    });
    return id;
  }

  Future<VehicleLog?> findOpenByPlate(String plate) async {
    final d = await db;
    final rows = await d.query(
      'vehicle_logs',
      where: 'plate = ? AND status = ?',
      whereArgs: [plate, 'OPEN'],
      orderBy: 'entry_time DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return VehicleLog.fromMap(rows.first);
  }

  Future<int> closeOpenLog(String id) async {
    final d = await db;
    return d.update(
      'vehicle_logs',
      {
        'exit_time': DateTime.now().toIso8601String(),
        'status': 'CLOSED',
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<List<VehicleLog>> listLogs({int limit = 200}) async {
    final d = await db;
    final rows = await d.query(
      'vehicle_logs',
      orderBy: 'entry_time DESC',
      limit: limit,
    );
    return rows.map(VehicleLog.fromMap).toList();
  }
}

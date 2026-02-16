/// Estados del flujo de un envío/shipment
enum ShipmentStatus {
  esperaIngreso,  // Llegada registrada, esperando ingreso a planta
  enEspera,       // Ingresó a planta, esperando carga
  enCarga,        // En proceso de carga
  cargado,        // Carga finalizada
  despachado,     // En camino a sucursal
  recibido,       // Llegó a sucursal
  incidencia,     // Tiene reclamo pendiente
  resuelto,       // Incidencia resuelta
}

/// Extensión para obtener nombre legible del estado
extension ShipmentStatusExt on ShipmentStatus {
  String get displayName {
    switch (this) {
      case ShipmentStatus.esperaIngreso:
        return 'Espera Ingreso';
      case ShipmentStatus.enEspera:
        return 'En Espera';
      case ShipmentStatus.enCarga:
        return 'En Carga';
      case ShipmentStatus.cargado:
        return 'Cargado';
      case ShipmentStatus.despachado:
        return 'Despachado';
      case ShipmentStatus.recibido:
        return 'Recibido';
      case ShipmentStatus.incidencia:
        return 'Con Incidencia';
      case ShipmentStatus.resuelto:
        return 'Resuelto';
    }
  }

  /// Color asociado al estado (hex string)
  String get colorHex {
    switch (this) {
      case ShipmentStatus.esperaIngreso:
        return '#FFA726'; // Orange
      case ShipmentStatus.enEspera:
        return '#42A5F5'; // Blue
      case ShipmentStatus.enCarga:
        return '#AB47BC'; // Purple
      case ShipmentStatus.cargado:
        return '#66BB6A'; // Green
      case ShipmentStatus.despachado:
        return '#26A69A'; // Teal
      case ShipmentStatus.recibido:
        return '#4CAF50'; // Green dark
      case ShipmentStatus.incidencia:
        return '#EF5350'; // Red
      case ShipmentStatus.resuelto:
        return '#78909C'; // Blue grey
    }
  }
}

/// Representa un envío/viaje de camión
class Shipment {
  final int? id;
  final int truckId;
  final int driverId;
  final int branchId;
  final ShipmentStatus status;
  final DateTime? arrivalTime;
  final DateTime? loadStart;
  final DateTime? loadEnd;
  final DateTime? dispatchTime;
  final DateTime? receptionTime;
  final double? latitude;
  final double? longitude;
  final String? notes;
  final DateTime createdAt;

  Shipment({
    this.id,
    required this.truckId,
    required this.driverId,
    required this.branchId,
    required this.status,
    this.arrivalTime,
    this.loadStart,
    this.loadEnd,
    this.dispatchTime,
    this.receptionTime,
    this.latitude,
    this.longitude,
    this.notes,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'truck_id': truckId,
    'driver_id': driverId,
    'branch_id': branchId,
    'status': status.name,
    'arrival_time': arrivalTime?.toIso8601String(),
    'load_start': loadStart?.toIso8601String(),
    'load_end': loadEnd?.toIso8601String(),
    'dispatch_time': dispatchTime?.toIso8601String(),
    'reception_time': receptionTime?.toIso8601String(),
    'latitude': latitude,
    'longitude': longitude,
    'notes': notes,
    'created_at': createdAt.toIso8601String(),
  };

  factory Shipment.fromMap(Map<String, dynamic> m) => Shipment(
    id: m['id'] as int?,
    truckId: m['truck_id'] as int,
    driverId: m['driver_id'] as int,
    branchId: m['branch_id'] as int,
    status: ShipmentStatus.values.byName(m['status'] as String),
    arrivalTime: m['arrival_time'] != null
        ? DateTime.parse(m['arrival_time'] as String)
        : null,
    loadStart: m['load_start'] != null
        ? DateTime.parse(m['load_start'] as String)
        : null,
    loadEnd: m['load_end'] != null
        ? DateTime.parse(m['load_end'] as String)
        : null,
    dispatchTime: m['dispatch_time'] != null
        ? DateTime.parse(m['dispatch_time'] as String)
        : null,
    receptionTime: m['reception_time'] != null
        ? DateTime.parse(m['reception_time'] as String)
        : null,
    latitude: m['latitude'] as double?,
    longitude: m['longitude'] as double?,
    notes: m['notes'] as String?,
    createdAt: DateTime.parse(m['created_at'] as String),
  );

  /// Crea una copia con campos modificados
  Shipment copyWith({
    int? id,
    int? truckId,
    int? driverId,
    int? branchId,
    ShipmentStatus? status,
    DateTime? arrivalTime,
    DateTime? loadStart,
    DateTime? loadEnd,
    DateTime? dispatchTime,
    DateTime? receptionTime,
    double? latitude,
    double? longitude,
    String? notes,
  }) => Shipment(
    id: id ?? this.id,
    truckId: truckId ?? this.truckId,
    driverId: driverId ?? this.driverId,
    branchId: branchId ?? this.branchId,
    status: status ?? this.status,
    arrivalTime: arrivalTime ?? this.arrivalTime,
    loadStart: loadStart ?? this.loadStart,
    loadEnd: loadEnd ?? this.loadEnd,
    dispatchTime: dispatchTime ?? this.dispatchTime,
    receptionTime: receptionTime ?? this.receptionTime,
    latitude: latitude ?? this.latitude,
    longitude: longitude ?? this.longitude,
    notes: notes ?? this.notes,
    createdAt: createdAt,
  );

  @override
  String toString() => 'Shipment(#$id, ${status.displayName})';
}

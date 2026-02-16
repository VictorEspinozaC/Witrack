/// Tipo de incidencia
enum IncidentType {
  faltante,     // Producto faltante
  danado,       // Producto dañado
  diferencia,   // Diferencia de cantidad
  otro,         // Otro tipo
}

/// Estado de resolución de incidencia
enum IncidentStatus {
  abierta,   // Pendiente de resolver
  enProceso, // En revisión
  resuelta,  // Resuelta
}

/// Representa una incidencia/reclamo en recepción
class Incident {
  final int? id;
  final int shipmentId;
  final IncidentType type;
  final String description;
  final String? photoPath;
  final IncidentStatus status;
  final String? resolution;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  Incident({
    this.id,
    required this.shipmentId,
    required this.type,
    required this.description,
    this.photoPath,
    this.status = IncidentStatus.abierta,
    this.resolution,
    DateTime? createdAt,
    this.resolvedAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'shipment_id': shipmentId,
    'type': type.name,
    'description': description,
    'photo_path': photoPath,
    'status': status.name,
    'resolution': resolution,
    'created_at': createdAt.toIso8601String(),
    'resolved_at': resolvedAt?.toIso8601String(),
  };

  factory Incident.fromMap(Map<String, dynamic> m) => Incident(
    id: m['id'] as int?,
    shipmentId: m['shipment_id'] as int,
    type: IncidentType.values.byName(m['type'] as String),
    description: m['description'] as String,
    photoPath: m['photo_path'] as String?,
    status: IncidentStatus.values.byName(m['status'] as String),
    resolution: m['resolution'] as String?,
    createdAt: DateTime.parse(m['created_at'] as String),
    resolvedAt: m['resolved_at'] != null
        ? DateTime.parse(m['resolved_at'] as String)
        : null,
  );

  Incident copyWith({
    int? id,
    int? shipmentId,
    IncidentType? type,
    String? description,
    String? photoPath,
    IncidentStatus? status,
    String? resolution,
    DateTime? resolvedAt,
  }) => Incident(
    id: id ?? this.id,
    shipmentId: shipmentId ?? this.shipmentId,
    type: type ?? this.type,
    description: description ?? this.description,
    photoPath: photoPath ?? this.photoPath,
    status: status ?? this.status,
    resolution: resolution ?? this.resolution,
    createdAt: createdAt,
    resolvedAt: resolvedAt ?? this.resolvedAt,
  );

  @override
  String toString() => 'Incident(#$id, ${type.name}, ${status.name})';
}

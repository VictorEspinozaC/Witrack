/// Tipo de incidencia
enum IncidentType {
  faltante,     // Producto faltante
  danado,       // Producto dañado
  diferencia,   // Diferencia de cantidad
  otro,         // Otro tipo
}

/// Estado de resolucion de incidencia
enum IncidentStatus {
  abierta,   // Pendiente de resolver
  enProceso, // En revision
  resuelta,  // Resuelta
}

/// Representa una incidencia/reclamo en recepcion
class Incident {
  final String? id;
  final String shipmentId;
  final IncidentType type;
  final String description;
  final String? photoPath;   // Ruta local de la foto
  final String? photoUrl;    // URL remota en Supabase Storage
  final IncidentStatus status;
  final String? resolution;
  final String? reportedBy;  // UUID del usuario que reporta
  final DateTime createdAt;
  final DateTime? resolvedAt;

  Incident({
    this.id,
    required this.shipmentId,
    required this.type,
    required this.description,
    this.photoPath,
    this.photoUrl,
    this.status = IncidentStatus.abierta,
    this.resolution,
    this.reportedBy,
    DateTime? createdAt,
    this.resolvedAt,
  }) : createdAt = createdAt ?? DateTime.now();

  /// Map para SQLite local
  Map<String, dynamic> toMap() => {
    'id': id,
    'shipment_id': shipmentId,
    'type': type.name,
    'description': description,
    'photo_path': photoPath,
    'photo_url': photoUrl,
    'status': status.name,
    'resolution': resolution,
    'reported_by': reportedBy,
    'created_at': createdAt.toIso8601String(),
    'resolved_at': resolvedAt?.toIso8601String(),
  };

  /// Map para enviar a Supabase (solo campos remotos)
  Map<String, dynamic> toSupabaseMap() => {
    'shipment_id': shipmentId,
    'type': type.name,
    'description': description,
    'photo_url': photoUrl ?? photoPath,
    'status': _statusToSupabase(status),
    'resolution': resolution,
    'reported_by': reportedBy,
    'created_at': createdAt.toIso8601String(),
    'resolved_at': resolvedAt?.toIso8601String(),
  };

  /// Convierte IncidentStatus al formato que espera Supabase (con guion bajo)
  static String _statusToSupabase(IncidentStatus s) {
    switch (s) {
      case IncidentStatus.abierta: return 'abierta';
      case IncidentStatus.enProceso: return 'en_proceso';
      case IncidentStatus.resuelta: return 'resuelta';
    }
  }

  /// Convierte status de Supabase a IncidentStatus
  static IncidentStatus _statusFromSupabase(String s) {
    switch (s) {
      case 'en_proceso': return IncidentStatus.enProceso;
      case 'abierta': return IncidentStatus.abierta;
      case 'resuelta': return IncidentStatus.resuelta;
      default: return IncidentStatus.values.byName(s);
    }
  }

  factory Incident.fromMap(Map<String, dynamic> m) => Incident(
    id: m['id']?.toString(),
    shipmentId: m['shipment_id']?.toString() ?? '',
    type: IncidentType.values.byName(m['type'] as String),
    description: m['description'] as String,
    photoPath: m['photo_path'] as String?,
    photoUrl: m['photo_url'] as String?,
    status: IncidentStatus.values.byName(m['status'] as String),
    resolution: m['resolution'] as String?,
    reportedBy: m['reported_by'] as String?,
    createdAt: DateTime.parse(m['created_at'] as String),
    resolvedAt: m['resolved_at'] != null
        ? DateTime.parse(m['resolved_at'] as String)
        : null,
  );

  /// Crea desde respuesta de Supabase (Pull)
  factory Incident.fromSupabase(Map<String, dynamic> m) => Incident(
    id: m['id']?.toString(),
    shipmentId: m['shipment_id']?.toString() ?? '',
    type: IncidentType.values.byName(m['type'] as String),
    description: m['description'] as String,
    photoUrl: m['photo_url'] as String?,
    status: _statusFromSupabase(m['status'] as String),
    resolution: m['resolution'] as String?,
    reportedBy: m['reported_by'] as String?,
    createdAt: m['created_at'] != null
        ? DateTime.parse(m['created_at'] as String)
        : DateTime.now(),
    resolvedAt: m['resolved_at'] != null
        ? DateTime.parse(m['resolved_at'] as String)
        : null,
  );

  Incident copyWith({
    String? id,
    String? shipmentId,
    IncidentType? type,
    String? description,
    String? photoPath,
    String? photoUrl,
    IncidentStatus? status,
    String? resolution,
    String? reportedBy,
    DateTime? resolvedAt,
  }) => Incident(
    id: id ?? this.id,
    shipmentId: shipmentId ?? this.shipmentId,
    type: type ?? this.type,
    description: description ?? this.description,
    photoPath: photoPath ?? this.photoPath,
    photoUrl: photoUrl ?? this.photoUrl,
    status: status ?? this.status,
    resolution: resolution ?? this.resolution,
    reportedBy: reportedBy ?? this.reportedBy,
    createdAt: createdAt,
    resolvedAt: resolvedAt ?? this.resolvedAt,
  );

  @override
  String toString() => 'Incident(#$id, ${type.name}, ${status.name})';
}

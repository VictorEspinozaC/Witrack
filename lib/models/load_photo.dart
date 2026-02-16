/// Foto asociada a una carga
class LoadPhoto {
  final int? id;
  final int shipmentId;
  final String path;       // Ruta local del archivo
  final String? imageUrl;  // URL remota en Supabase Storage
  final String? comment;
  final DateTime createdAt;

  LoadPhoto({
    this.id,
    required this.shipmentId,
    required this.path,
    this.imageUrl,
    this.comment,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'shipment_id': shipmentId,
    'path': path,
    'image_url': imageUrl,
    'comment': comment,
    'created_at': createdAt.toIso8601String(),
  };

  /// Convierte a Map para enviar a Supabase (solo campos remotos)
  Map<String, dynamic> toSupabaseMap() => {
    'shipment_id': shipmentId,
    'image_url': imageUrl ?? path,
    'comment': comment,
    'created_at': createdAt.toIso8601String(),
  };

  factory LoadPhoto.fromMap(Map<String, dynamic> m) => LoadPhoto(
    id: m['id'] as int?,
    shipmentId: m['shipment_id'] as int,
    path: (m['path'] ?? m['image_url'] ?? '') as String,
    imageUrl: m['image_url'] as String?,
    comment: m['comment'] as String?,
    createdAt: DateTime.parse(m['created_at'] as String),
  );

  /// Crea desde respuesta de Supabase (Pull)
  factory LoadPhoto.fromSupabase(Map<String, dynamic> m) => LoadPhoto(
    shipmentId: m['shipment_id'] as int,
    path: (m['image_url'] ?? '') as String,
    imageUrl: m['image_url'] as String?,
    comment: m['comment'] as String?,
    createdAt: m['created_at'] != null
        ? DateTime.parse(m['created_at'] as String)
        : DateTime.now(),
  );

  @override
  String toString() => 'LoadPhoto(#$id, shipment:$shipmentId)';
}

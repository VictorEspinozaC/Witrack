/// Foto asociada a una carga
class LoadPhoto {
  final int? id;
  final int shipmentId;
  final String path;
  final String? comment;
  final DateTime createdAt;

  LoadPhoto({
    this.id,
    required this.shipmentId,
    required this.path,
    this.comment,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'shipment_id': shipmentId,
    'path': path,
    'comment': comment,
    'created_at': createdAt.toIso8601String(),
  };

  factory LoadPhoto.fromMap(Map<String, dynamic> m) => LoadPhoto(
    id: m['id'] as int?,
    shipmentId: m['shipment_id'] as int,
    path: m['path'] as String,
    comment: m['comment'] as String?,
    createdAt: DateTime.parse(m['created_at'] as String),
  );

  @override
  String toString() => 'LoadPhoto(#$id, shipment:$shipmentId)';
}

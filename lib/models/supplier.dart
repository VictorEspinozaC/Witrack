/// Representa un proveedor
class Supplier {
  final String? id;
  final String name;
  // Dirección estructurada
  final String region;
  final String comuna;
  final String calle;
  final String numeracion;
  final String depto;

  Supplier({
    this.id,
    required this.name,
    this.region = '',
    this.comuna = '',
    this.calle = '',
    this.numeracion = '',
    this.depto = '',
  });

  /// Dirección formateada para display.
  String get direccionFormateada {
    final parts = <String>[];
    if (calle.isNotEmpty) parts.add(calle);
    if (numeracion.isNotEmpty) parts.add('#$numeracion');
    if (depto.isNotEmpty) parts.add('Depto/Of. $depto');
    if (comuna.isNotEmpty) parts.add(comuna);
    if (region.isNotEmpty) parts.add(region);
    return parts.isEmpty ? 'Sin dirección' : parts.join(', ');
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'region': region,
    'comuna': comuna,
    'calle': calle,
    'numeracion': numeracion,
    'depto': depto,
  };

  factory Supplier.fromMap(Map<String, dynamic> m) => Supplier(
    id: m['id']?.toString(),
    name: m['name'] as String,
    region: (m['region'] as String?) ?? '',
    comuna: (m['comuna'] as String?) ?? '',
    calle: (m['calle'] as String?) ?? '',
    numeracion: (m['numeracion'] as String?) ?? '',
    depto: (m['depto'] as String?) ?? '',
  );
}

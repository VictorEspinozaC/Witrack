/// Representa un cliente
class Client {
  final String? id;
  final String name; // Razón Social
  final String rut;
  // Dirección de facturación estructurada
  final String region;
  final String comuna;
  final String calle;
  final String numeracion;
  final String depto;

  Client({
    this.id,
    required this.name,
    required this.rut,
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
    'rut': rut,
    'region': region,
    'comuna': comuna,
    'calle': calle,
    'numeracion': numeracion,
    'depto': depto,
  };

  factory Client.fromMap(Map<String, dynamic> m) => Client(
    id: m['id']?.toString(),
    name: m['name'] as String,
    rut: m['rut'] as String,
    region: (m['region'] as String?) ?? '',
    comuna: (m['comuna'] as String?) ?? '',
    calle: (m['calle'] as String?) ?? (m['billing_address'] as String?) ?? '',
    numeracion: (m['numeracion'] as String?) ?? '',
    depto: (m['depto'] as String?) ?? '',
  );
}

/// Representa una dirección de despacho de un cliente
class DispatchAddress {
  final String? id;
  final String clientId;
  // Dirección estructurada
  final String region;
  final String comuna;
  final String calle;
  final String numeracion;
  final String depto;

  DispatchAddress({
    this.id,
    required this.clientId,
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
    'client_id': clientId,
    'region': region,
    'comuna': comuna,
    'calle': calle,
    'numeracion': numeracion,
    'depto': depto,
  };

  factory DispatchAddress.fromMap(Map<String, dynamic> m) => DispatchAddress(
    id: m['id']?.toString(),
    clientId: m['client_id']?.toString() ?? '',
    region: (m['region'] as String?) ?? '',
    comuna: (m['comuna'] as String?) ?? '',
    calle: (m['calle'] as String?) ?? (m['address'] as String?) ?? '',
    numeracion: (m['numeracion'] as String?) ?? '',
    depto: (m['depto'] as String?) ?? '',
  );
}

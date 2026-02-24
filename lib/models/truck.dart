/// Tipo de camión según operación
enum TruckType {
  carga,    // Para despacho/salida
  descarga, // Para recepción/entrada
}

/// Clasificación detallada del camión
enum TruckClassification {
  branchLoad,      // Carga a sucursales
  supplierUnload,  // Descarga de proveedores
  maquila          // Tercerización / Maquila
}

/// Representa un camión
class Truck {
  final String? id;
  final String plate;
  final TruckType type;
  final TruckClassification? classification;
  final String? transportCompanyId;

  Truck({
    this.id,
    required this.plate,
    required this.type,
    this.classification,
    this.transportCompanyId,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'plate': plate,
    'type': type.name,
    'classification': classification?.name,
    'transport_company_id': transportCompanyId,
  };

  factory Truck.fromMap(Map<String, dynamic> m) => Truck(
    id: m['id']?.toString(),
    plate: m['plate'] as String,
    type: TruckType.values.byName(m['type'] as String),
    classification: m['classification'] != null 
        ? TruckClassification.values.byName(m['classification'] as String)
        : null,
    transportCompanyId: m['transport_company_id']?.toString(),
  );

  @override
  String toString() => 'Truck($plate, ${type.name})';
}

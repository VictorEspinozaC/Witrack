/// Tipo de camión según operación
enum TruckType {
  carga,    // Para despacho/salida
  descarga, // Para recepción/entrada
}

/// Representa un camión
class Truck {
  final int? id;
  final String plate;
  final TruckType type;

  Truck({
    this.id,
    required this.plate,
    required this.type,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'plate': plate,
    'type': type.name,
  };

  factory Truck.fromMap(Map<String, dynamic> m) => Truck(
    id: m['id'] as int?,
    plate: m['plate'] as String,
    type: TruckType.values.byName(m['type'] as String),
  );

  @override
  String toString() => 'Truck($plate, ${type.name})';
}

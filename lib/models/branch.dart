/// Representa una sucursal destino
class Branch {
  final int? id;
  final String name;
  final String code;

  Branch({this.id, required this.name, required this.code});

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'code': code,
  };

  factory Branch.fromMap(Map<String, dynamic> m) => Branch(
    id: m['id'] as int?,
    name: m['name'] as String,
    code: m['code'] as String,
  );

  @override
  String toString() => 'Branch($code: $name)';
}

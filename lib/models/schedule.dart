/// Estado de una programación
enum ScheduleStatus {
  pending,   // Pendiente de asignar camión
  assigned,  // Camión asignado
  cancelled, // Anulada
}

/// Representa una programación importada
class Schedule {
  final int? id;
  final int branchId;
  final DateTime scheduledDate;
  final int? truckId; // null si no está asignado
  final ScheduleStatus status;
  final String? notes;

  Schedule({
    this.id,
    required this.branchId,
    required this.scheduledDate,
    this.truckId,
    this.status = ScheduleStatus.pending,
    this.notes,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'branch_id': branchId,
    'scheduled_date': scheduledDate.toIso8601String(),
    'truck_id': truckId,
    'status': status.name,
    'notes': notes,
  };

  factory Schedule.fromMap(Map<String, dynamic> m) => Schedule(
    id: m['id'] as int?,
    branchId: m['branch_id'] as int,
    scheduledDate: DateTime.parse(m['scheduled_date'] as String),
    truckId: m['truck_id'] as int?,
    status: ScheduleStatus.values.byName(m['status'] as String),
    notes: m['notes'] as String?,
  );

  Schedule copyWith({
    int? id,
    int? branchId,
    DateTime? scheduledDate,
    int? truckId,
    ScheduleStatus? status,
    String? notes,
  }) => Schedule(
    id: id ?? this.id,
    branchId: branchId ?? this.branchId,
    scheduledDate: scheduledDate ?? this.scheduledDate,
    truckId: truckId ?? this.truckId,
    status: status ?? this.status,
    notes: notes ?? this.notes,
  );

  @override
  String toString() => 'Schedule(#$id, ${status.name})';
}

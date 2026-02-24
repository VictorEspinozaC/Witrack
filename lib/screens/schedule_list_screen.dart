import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../services/csv_import_service.dart';
import '../theme/app_theme.dart';

class ScheduleListScreen extends StatefulWidget {
  const ScheduleListScreen({super.key});

  @override
  State<ScheduleListScreen> createState() => _ScheduleListScreenState();
}

class _ScheduleListScreenState extends State<ScheduleListScreen> {
  final _db = AppDatabase.instance;
  final _csvService = CsvImportService();
  
  List<Schedule> _schedules = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    final schedules = await _db.getSchedules();
    setState(() {
      _schedules = schedules;
      _loading = false;
    });
  }

  Future<void> _importCsv() async {
    final result = await _csvService.importSchedule();
    
    if (!mounted) return;

    if (result['success']) {
      final imported = result['imported'];
      final errors = result['errors'];
      final details = result['details'] as List<String>;

      String message = 'Importados: $imported';
      if (errors > 0) message += ', Errores: $errors';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: errors > 0 ? Colors.orange : Colors.green,
          action: errors > 0
              ? SnackBarAction(
                  label: 'Ver Errores',
                  textColor: Colors.white,
                  onPressed: () => _showErrorDialog(details),
                )
              : null,
        ),
      );
      _loadData();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showErrorDialog(List<String> errors) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Errores de Importación'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: errors.length,
            itemBuilder: (context, index) => ListTile(
              title: Text(errors[index], style: const TextStyle(fontSize: 12)),
              leading: const Icon(Icons.error_outline, color: Colors.red, size: 16),
              visualDensity: VisualDensity.compact,
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  void _showManualEntryDialog() async {
    final branches = await _db.getAllBranches();

    if (!mounted) return;

    if (branches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Crea al menos una sucursal antes de agendar (menú → Administrar Sucursales).'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => _ScheduleFormDialog(
        branches: branches,
        onSaved: (branchId, date) async {
          await _db.insertSchedule(Schedule(
            branchId: branchId,
            scheduledDate: date,
          ));
          _loadData();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Programación creada exitosamente'), backgroundColor: Colors.green),
            );
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Programación'),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_upload),
            onPressed: _importCsv,
            tooltip: 'Importar CSV',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _schedules.isEmpty
              ? _buildEmptyState()
              : _buildList(),
      floatingActionButton: FloatingActionButton(
        onPressed: _showManualEntryDialog,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.calendar_today, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          const Text('No hay programaciones'),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: _showManualEntryDialog,
            icon: const Icon(Icons.add),
            label: const Text('Agregar Manualmente'),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
             onPressed: _importCsv,
             icon: const Icon(Icons.upload_file),
             label: const Text('Importar desde CSV'),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        itemCount: _schedules.length,
        itemBuilder: (context, index) {
          final schedule = _schedules[index];
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: ListTile(
              leading: _buildDateBadge(schedule),
              title: FutureBuilder<Truck?>(
                future: schedule.truckId != null 
                  ? _db.getTruckById(schedule.truckId!) 
                  : Future.value(null),
                builder: (context, snapshot) {
                  return Text(
                    snapshot.data?.plate ?? 'Sin Patente',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: schedule.truckId != null ? Colors.black : Colors.grey,
                    ),
                  );
                },
              ),
              subtitle: FutureBuilder<Branch?>(
                future: _db.getBranchById(schedule.branchId),
                builder: (context, snapshot) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(snapshot.data?.name ?? 'Cargando...'),
                      if (schedule.notes != null)
                        Text(
                          schedule.notes!,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                    ],
                  );
                },
              ),
              trailing: Chip(
                label: Text(
                  schedule.status == ScheduleStatus.assigned ? 'Asignado' : 'Pendiente',
                  style: const TextStyle(fontSize: 10, color: Colors.white),
                ),
                backgroundColor: schedule.status == ScheduleStatus.assigned 
                    ? AppTheme.successColor 
                    : Colors.orange,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDateBadge(Schedule schedule) {
    final day = schedule.scheduledDate.day.toString();
    final month = DateFormat('MMM').format(schedule.scheduledDate).toUpperCase();
    
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.primaryColor.withOpacity(0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            day,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: AppTheme.primaryColor,
            ),
          ),
          Text(
            month,
            style: TextStyle(
              fontSize: 10,
              color: AppTheme.primaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleFormDialog extends StatefulWidget {
  final List<Branch> branches;
  final Function(String branchId, DateTime date) onSaved;

  const _ScheduleFormDialog({required this.branches, required this.onSaved});

  @override
  State<_ScheduleFormDialog> createState() => _ScheduleFormDialogState();
}

class _ScheduleFormDialogState extends State<_ScheduleFormDialog> {
  String? _selectedBranchId;
  DateTime _selectedDate = DateTime.now();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    // Preseleccionar primera sucursal si existe
    if (widget.branches.isNotEmpty) {
      _selectedBranchId = widget.branches.first.id;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nueva Programación'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Sucursal', style: TextStyle(fontWeight: FontWeight.bold)),
            DropdownButtonFormField<String>(
              value: _selectedBranchId,
              isExpanded: true,
              items: widget.branches.map((b) => DropdownMenuItem(
                value: b.id,
                child: Text(b.name),
              )).toList(),
              onChanged: (val) => setState(() => _selectedBranchId = val),
              decoration: const InputDecoration(
                hintText: 'Seleccione sucursal',
              ),
              validator: (val) => val == null ? 'Requerido' : null,
            ),
            const SizedBox(height: 16),
            const Text('Fecha Programación', style: TextStyle(fontWeight: FontWeight.bold)),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  setState(() => _selectedDate = picked);
                }
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  suffixIcon: Icon(Icons.calendar_today),
                ),
                child: Text(
                  DateFormat('dd/MM/yyyy').format(_selectedDate),
                  style: const TextStyle(fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              widget.onSaved(_selectedBranchId!, _selectedDate);
              Navigator.pop(context);
            }
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}

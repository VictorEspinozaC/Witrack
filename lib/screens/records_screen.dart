import 'package:flutter/material.dart';
import '../db/vehicle_log_db.dart';

class RecordsScreen extends StatefulWidget {
  const RecordsScreen({super.key});

  @override
  State<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends State<RecordsScreen> {
  late Future<List<VehicleLog>> _future;

  @override
  void initState() {
    super.initState();
    _future = VehicleLogDb.instance.listLogs();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = VehicleLogDb.instance.listLogs();
    });
  }

  String _fmt(DateTime dt) {
    final p2 = (int v) => v.toString().padLeft(2, '0');
    return '${dt.year}-${p2(dt.month)}-${p2(dt.day)} ${p2(dt.hour)}:${p2(dt.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registros')),
      body: FutureBuilder<List<VehicleLog>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final items = snap.data!;
          if (items.isEmpty) return const Center(child: Text('Sin registros aún'));

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final it = items[i];
                final subtitle = [
                  'Ingreso: ${_fmt(it.entryTime)}',
                  if (it.exitTime != null) 'Salida: ${_fmt(it.exitTime!)}',
                  if ((it.driverName ?? '').isNotEmpty) 'Chofer: ${it.driverName} (${it.driverRut})',
                ].join('  •  ');

                return ListTile(
                  title: Text('${it.plate}  (${it.status})'),
                  subtitle: Text(subtitle),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

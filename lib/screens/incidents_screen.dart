import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'shipment_detail_screen.dart';

/// Pantalla de gestión de incidencias
class IncidentsScreen extends StatefulWidget {
  const IncidentsScreen({super.key});

  @override
  State<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends State<IncidentsScreen>
    with SingleTickerProviderStateMixin {
  final _db = AppDatabase.instance;
  late TabController _tabController;

  List<Incident> _openIncidents = [];
  List<Incident> _resolvedIncidents = [];
  final Map<int, Shipment?> _shipmentsCache = {};
  final Map<int, Truck?> _trucksCache = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);

    final db = await _db.db;

    // Cargar incidencias abiertas
    final openRows = await db.query(
      'incidents',
      where: 'status != ?',
      whereArgs: [IncidentStatus.resuelta.name],
      orderBy: 'created_at DESC',
    );
    _openIncidents = openRows.map(Incident.fromMap).toList();

    // Cargar incidencias resueltas (últimas 50)
    final resolvedRows = await db.query(
      'incidents',
      where: 'status = ?',
      whereArgs: [IncidentStatus.resuelta.name],
      orderBy: 'resolved_at DESC',
      limit: 50,
    );
    _resolvedIncidents = resolvedRows.map(Incident.fromMap).toList();

    // Precargar shipments y trucks para mostrar info
    final allIncidents = [..._openIncidents, ..._resolvedIncidents];
    for (final incident in allIncidents) {
      if (!_shipmentsCache.containsKey(incident.shipmentId)) {
        final shipment = await _db.getShipmentById(incident.shipmentId);
        _shipmentsCache[incident.shipmentId] = shipment;
        if (shipment != null && !_trucksCache.containsKey(shipment.truckId)) {
          _trucksCache[shipment.truckId] = await _db.getTruckById(
            shipment.truckId,
          );
        }
      }
    }

    setState(() => _loading = false);
  }

  Future<void> _resolveIncident(Incident incident) async {
    final controller = TextEditingController();

    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 20,
          right: 20,
          top: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green, size: 28),
                const SizedBox(width: 12),
                Text(
                  'Resolver Incidencia',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Tipo: ${_getIncidentTypeName(incident.type)}',
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Text(incident.description),
            const SizedBox(height: 20),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Resolución / Acuerdo',
                hintText: 'Ej: Se emitió nota de crédito por \$50.000',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
              autofocus: true,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context, true),
                    icon: const Icon(Icons.check),
                    label: const Text('Resolver'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );

    if (result == true && controller.text.isNotEmpty) {
      await _db.resolveIncident(incident.id!, controller.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Incidencia resuelta ✅'),
            backgroundColor: Colors.green,
          ),
        );
        _loadData();
      }
    }
  }

  String _getIncidentTypeName(IncidentType type) {
    switch (type) {
      case IncidentType.faltante:
        return 'Producto Faltante';
      case IncidentType.danado:
        return 'Producto Dañado';
      case IncidentType.diferencia:
        return 'Diferencia de Cantidad';
      case IncidentType.otro:
        return 'Otro';
    }
  }

  Color _getIncidentTypeColor(IncidentType type) {
    switch (type) {
      case IncidentType.faltante:
        return Colors.orange;
      case IncidentType.danado:
        return Colors.red;
      case IncidentType.diferencia:
        return Colors.purple;
      case IncidentType.otro:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Incidencias'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Abiertas'),
                  if (_openIncidents.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${_openIncidents.length}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: 'Resueltas'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildIncidentsList(_openIncidents, isOpen: true),
                _buildIncidentsList(_resolvedIncidents, isOpen: false),
              ],
            ),
    );
  }

  Widget _buildIncidentsList(List<Incident> incidents, {required bool isOpen}) {
    if (incidents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isOpen ? Icons.check_circle_outline : Icons.history,
              size: 64,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              isOpen
                  ? 'No hay incidencias pendientes'
                  : 'No hay historial de incidencias',
              style: TextStyle(color: Colors.grey.shade500),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: incidents.length,
        itemBuilder: (context, index) {
          final incident = incidents[index];
          return _IncidentCard(
            incident: incident,
            shipment: _shipmentsCache[incident.shipmentId],
            truck: _shipmentsCache[incident.shipmentId] != null
                ? _trucksCache[_shipmentsCache[incident.shipmentId]!.truckId]
                : null,
            typeName: _getIncidentTypeName(incident.type),
            typeColor: _getIncidentTypeColor(incident.type),
            onResolve: isOpen ? () => _resolveIncident(incident) : null,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) =>
                      ShipmentDetailScreen(shipmentId: incident.shipmentId),
                ),
              ).then((_) => _loadData());
            },
          );
        },
      ),
    );
  }
}

class _IncidentCard extends StatelessWidget {
  final Incident incident;
  final Shipment? shipment;
  final Truck? truck;
  final String typeName;
  final Color typeColor;
  final VoidCallback? onResolve;
  final VoidCallback onTap;

  const _IncidentCard({
    required this.incident,
    this.shipment,
    this.truck,
    required this.typeName,
    required this.typeColor,
    this.onResolve,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final isResolved = incident.status == IncidentStatus.resuelta;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header con tipo y estado
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: typeColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: typeColor.withOpacity(0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getTypeIcon(incident.type),
                          size: 16,
                          color: typeColor,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          typeName,
                          style: TextStyle(
                            color: typeColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: isResolved
                          ? Colors.green.shade50
                          : Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isResolved ? 'Resuelta' : 'Pendiente',
                      style: TextStyle(
                        color: isResolved ? Colors.green : Colors.orange,
                        fontWeight: FontWeight.w500,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Info del camión
              if (truck != null) ...[
                Row(
                  children: [
                    const Icon(
                      Icons.local_shipping,
                      size: 18,
                      color: Colors.grey,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      truck!.plate,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],

              // Descripción
              Text(
                incident.description,
                style: const TextStyle(fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),

              // Resolución si existe
              if (incident.resolution != null &&
                  incident.resolution!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 16,
                        color: Colors.green.shade700,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          incident.resolution!,
                          style: TextStyle(
                            color: Colors.green.shade700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // Footer con fecha y acciones
              Row(
                children: [
                  Icon(
                    Icons.access_time,
                    size: 14,
                    color: Colors.grey.shade500,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    dateFormat.format(incident.createdAt),
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                  ),
                  const Spacer(),
                  if (onResolve != null)
                    TextButton.icon(
                      onPressed: onResolve,
                      icon: const Icon(Icons.check_circle, size: 18),
                      label: const Text('Resolver'),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.green,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                    )
                  else
                    Icon(Icons.chevron_right, color: Colors.grey.shade400),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getTypeIcon(IncidentType type) {
    switch (type) {
      case IncidentType.faltante:
        return Icons.remove_circle_outline;
      case IncidentType.danado:
        return Icons.broken_image;
      case IncidentType.diferencia:
        return Icons.compare_arrows;
      case IncidentType.otro:
        return Icons.help_outline;
    }
  }
}

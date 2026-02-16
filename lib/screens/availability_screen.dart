import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import '../db/app_database.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'shipment_detail_screen.dart';

/// Pantalla principal de disponibilidad en planta
class AvailabilityScreen extends StatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  State<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends State<AvailabilityScreen> {
  final _db = AppDatabase.instance;
  
  List<Shipment> _shipments = [];
  List<Branch> _branches = [];
  bool _loading = true;
  
  // Filtros
  ShipmentStatus? _selectedStatus;
  int? _selectedBranchId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    
    final branches = await _db.getAllBranches();
    final shipments = await _db.getActiveShipments(branchId: _selectedBranchId);
    
    // Filtrar por estado si está seleccionado
    final filtered = _selectedStatus != null
        ? shipments.where((s) => s.status == _selectedStatus).toList()
        : shipments;
    
    setState(() {
      _branches = branches;
      _shipments = filtered;
      _loading = false;
    });
  }

  void _onStatusFilterChanged(ShipmentStatus? status) {
    setState(() => _selectedStatus = status);
    _loadData();
  }

  void _onBranchFilterChanged(int? branchId) {
    setState(() => _selectedBranchId = branchId);
    _loadData();
  }

  void _openDetail(Shipment shipment) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ShipmentDetailScreen(shipmentId: shipment.id!),
      ),
    ).then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Disponibilidad en Planta'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilters(),
          if (!_loading && _shipments.isNotEmpty) ...[
            _buildKPIs(),
            const SizedBox(height: 10),
            _buildCharts(),
          ],
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _shipments.isEmpty
                    ? _buildEmptyState()
                    : _buildShipmentList(),
          ),
        ],
      ),
    );
  }

  Widget _buildKPIs() {
    final total = _shipments.length;
    final enEspera = _shipments.where((s) => s.status == ShipmentStatus.enEspera || s.status == ShipmentStatus.esperaIngreso).length;
    final cargando = _shipments.where((s) => s.status == ShipmentStatus.enCarga).length;
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(child: _KPICard(title: 'Total', value: '$total', color: Colors.blue, icon: Icons.local_shipping)),
          const SizedBox(width: 8),
          Expanded(child: _KPICard(title: 'Espera', value: '$enEspera', color: Colors.orange, icon: Icons.timer)),
          const SizedBox(width: 8),
          Expanded(child: _KPICard(title: 'Cargando', value: '$cargando', color: Colors.green, icon: Icons.loop)),
        ],
      ),
    );
  }

  Widget _buildCharts() {
    if (_shipments.isEmpty) return const SizedBox.shrink();

    // Calcular distribución
    final statusCounts = <ShipmentStatus, int>{};
    for (final s in _shipments) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    final sections = statusCounts.entries.map((e) {
      final color = AppTheme.getStatusColor(e.key.name);
      return PieChartSectionData(
        color: color,
        value: e.value.toDouble(),
        title: '${e.value}',
        radius: 40,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      );
    }).toList();

    return Container(
      height: 150,
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          Expanded(
            child: PieChart(
              PieChartData(
                sections: sections,
                centerSpaceRadius: 30,
                sectionsSpace: 2,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: statusCounts.entries.map((e) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      color: AppTheme.getStatusColor(e.key.name),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${e.key.displayName} (${e.value})',
                      style: const TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    final activeStatuses = [
      ShipmentStatus.esperaIngreso,
      ShipmentStatus.enEspera,
      ShipmentStatus.enCarga,
      ShipmentStatus.cargado,
      ShipmentStatus.despachado,
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Filtro por estado
          Text(
            'Estado',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                FilterChip(
                  label: const Text('Todos'),
                  selected: _selectedStatus == null,
                  onSelected: (_) => _onStatusFilterChanged(null),
                  selectedColor: AppTheme.secondaryColor.withOpacity(0.2),
                  checkmarkColor: AppTheme.primaryColor,
                ),
                const SizedBox(width: 8),
                ...activeStatuses.map((status) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(status.displayName),
                    selected: _selectedStatus == status,
                    onSelected: (_) => _onStatusFilterChanged(status),
                    selectedColor: AppTheme.getStatusColor(status.name).withOpacity(0.2),
                    checkmarkColor: AppTheme.getStatusColor(status.name),
                    avatar: _selectedStatus == status
                        ? null
                        : CircleAvatar(
                            backgroundColor: AppTheme.getStatusColor(status.name),
                            radius: 6,
                          ),
                  ),
                )),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Filtro por sucursal
          Text(
            'Sucursal',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                FilterChip(
                  label: const Text('Todas'),
                  selected: _selectedBranchId == null,
                  onSelected: (_) => _onBranchFilterChanged(null),
                  selectedColor: AppTheme.secondaryColor.withOpacity(0.2),
                  checkmarkColor: AppTheme.primaryColor,
                ),
                const SizedBox(width: 8),
                ..._branches.map((branch) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(branch.code),
                    selected: _selectedBranchId == branch.id,
                    onSelected: (_) => _onBranchFilterChanged(branch.id),
                    selectedColor: AppTheme.secondaryColor.withOpacity(0.2),
                    checkmarkColor: AppTheme.primaryColor,
                  ),
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.local_shipping_outlined,
            size: 80,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            'No hay camiones activos',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Los camiones registrados aparecerán aquí',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShipmentList() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 80),
        itemCount: _shipments.length,
        itemBuilder: (context, index) => _ShipmentCard(
          shipment: _shipments[index],
          onTap: () => _openDetail(_shipments[index]),
        ),
      ),
    );
  }
}

class _KPICard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;
  final IconData icon;

  const _KPICard({required this.title, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 4),
              Text(title, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

/// Card individual de un shipment
class _ShipmentCard extends StatelessWidget {
  final Shipment shipment;
  final VoidCallback onTap;

  const _ShipmentCard({required this.shipment, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final statusColor = AppTheme.getStatusColor(shipment.status.name);
    final dateFormat = DateFormat('dd/MM HH:mm');

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Indicador de estado
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: statusColor.withOpacity(0.4),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Estado
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: statusColor.withOpacity(0.3)),
                    ),
                    child: Text(
                      shipment.status.displayName,
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const Spacer(),
                  // Hora de llegada
                  if (shipment.arrivalTime != null)
                    Text(
                      dateFormat.format(shipment.arrivalTime!),
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 13,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              // Info del camión (se cargará async)
              FutureBuilder<Truck?>(
                future: AppDatabase.instance.getTruckById(shipment.truckId),
                builder: (context, snapshot) {
                  final plate = snapshot.data?.plate ?? '...';
                  return Row(
                    children: [
                      Icon(Icons.local_shipping, 
                        color: AppTheme.primaryColor,
                        size: 28,
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            plate,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                          FutureBuilder<Driver?>(
                            future: AppDatabase.instance.getDriverById(shipment.driverId),
                            builder: (context, driverSnap) {
                              final driver = driverSnap.data?.name ?? '...';
                              return Text(
                                driver,
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontSize: 13,
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                      const Spacer(),
                      // Sucursal destino
                      FutureBuilder<Branch?>(
                        future: AppDatabase.instance.getBranchById(shipment.branchId),
                        builder: (context, branchSnap) {
                          final branch = branchSnap.data?.code ?? '...';
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.store,
                                  size: 16,
                                  color: AppTheme.primaryColor,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  branch,
                                  style: TextStyle(
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  );
                },
              ),
              // Notas si existen
              if (shipment.notes != null && shipment.notes!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.notes, size: 16, color: Colors.grey.shade600),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          shipment.notes!,
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 13,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              // Footer con acciones rápidas según estado
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Icon(
                    Icons.chevron_right,
                    color: Colors.grey.shade400,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

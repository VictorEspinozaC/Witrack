import 'package:flutter/material.dart';
import 'chile_locations.dart';

/// Datos estructurados de una dirección chilena.
class AddressData {
  final String region;
  final String comuna;
  final String calle;
  final String numeracion;
  final String depto;

  const AddressData({
    this.region = '',
    this.comuna = '',
    this.calle = '',
    this.numeracion = '',
    this.depto = '',
  });

  /// Dirección formateada en una sola línea.
  String get formatted {
    final parts = <String>[];
    if (calle.isNotEmpty) parts.add(calle);
    if (numeracion.isNotEmpty) parts.add('#$numeracion');
    if (depto.isNotEmpty) parts.add('Depto/Of. $depto');
    if (comuna.isNotEmpty) parts.add(comuna);
    if (region.isNotEmpty) parts.add(region);
    return parts.join(', ');
  }

  bool get isEmpty => region.isEmpty && comuna.isEmpty && calle.isEmpty;
}

/// Widget reutilizable para ingreso de direcciones jerárquicas:
/// Región → Comuna → Calle → Numeración → Depto/Oficina
class AddressFormWidget extends StatefulWidget {
  final AddressData? initialData;
  final ValueChanged<AddressData>? onChanged;
  final bool isCompact;

  const AddressFormWidget({
    super.key,
    this.initialData,
    this.onChanged,
    this.isCompact = false,
  });

  @override
  State<AddressFormWidget> createState() => _AddressFormWidgetState();
}

class _AddressFormWidgetState extends State<AddressFormWidget> {
  String? _selectedRegion;
  String? _selectedComuna;
  late TextEditingController _calleController;
  late TextEditingController _numeracionController;
  late TextEditingController _deptoController;

  List<String> _comunas = [];

  @override
  void initState() {
    super.initState();
    final data = widget.initialData;
    _selectedRegion = data != null && data.region.isNotEmpty ? data.region : null;
    _selectedComuna = data != null && data.comuna.isNotEmpty ? data.comuna : null;
    _calleController = TextEditingController(text: data?.calle ?? '');
    _numeracionController = TextEditingController(text: data?.numeracion ?? '');
    _deptoController = TextEditingController(text: data?.depto ?? '');

    if (_selectedRegion != null) {
      _comunas = ChileLocations.getComunas(_selectedRegion!);
    }
  }

  @override
  void dispose() {
    _calleController.dispose();
    _numeracionController.dispose();
    _deptoController.dispose();
    super.dispose();
  }

  void _notifyChange() {
    widget.onChanged?.call(AddressData(
      region: _selectedRegion ?? '',
      comuna: _selectedComuna ?? '',
      calle: _calleController.text.trim(),
      numeracion: _numeracionController.text.trim(),
      depto: _deptoController.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Región
        DropdownButtonFormField<String>(
          value: _selectedRegion,
          decoration: const InputDecoration(
            labelText: 'Región',
            prefixIcon: Icon(Icons.map, size: 20),
            isDense: true,
          ),
          isExpanded: true,
          items: ChileLocations.getRegiones()
              .map((r) => DropdownMenuItem(value: r, child: Text(r, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (value) {
            setState(() {
              _selectedRegion = value;
              _selectedComuna = null;
              _comunas = value != null ? ChileLocations.getComunas(value) : [];
            });
            _notifyChange();
          },
        ),
        const SizedBox(height: 12),

        // Comuna
        DropdownButtonFormField<String>(
          value: _selectedComuna,
          decoration: const InputDecoration(
            labelText: 'Comuna',
            prefixIcon: Icon(Icons.location_city, size: 20),
            isDense: true,
          ),
          isExpanded: true,
          items: _comunas
              .map((c) => DropdownMenuItem(value: c, child: Text(c)))
              .toList(),
          onChanged: _comunas.isEmpty
              ? null
              : (value) {
                  setState(() => _selectedComuna = value);
                  _notifyChange();
                },
          hint: Text(
            _comunas.isEmpty ? 'Seleccione una región primero' : 'Seleccione comuna',
          ),
        ),
        const SizedBox(height: 12),

        // Calle
        TextField(
          controller: _calleController,
          decoration: const InputDecoration(
            labelText: 'Calle',
            prefixIcon: Icon(Icons.signpost, size: 20),
          ),
          onChanged: (_) => _notifyChange(),
        ),
        const SizedBox(height: 12),

        // Numeración + Depto en una fila
        Row(
          children: [
            Expanded(
              flex: 2,
              child: TextField(
                controller: _numeracionController,
                decoration: const InputDecoration(
                  labelText: 'Numeración',
                  prefixIcon: Icon(Icons.pin, size: 20),
                ),
                keyboardType: TextInputType.text,
                onChanged: (_) => _notifyChange(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: TextField(
                controller: _deptoController,
                decoration: const InputDecoration(
                  labelText: 'Depto / Oficina',
                  prefixIcon: Icon(Icons.apartment, size: 20),
                ),
                onChanged: (_) => _notifyChange(),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

import 'dart:io';
import 'package:csv/csv.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import '../db/app_database.dart';
import '../models/models.dart';

class CsvImportService {
  final _db = AppDatabase.instance;

  /// Importa una programación desde un archivo CSV.
  /// Formato esperado: CodigoSucursal, Fecha(DD-MM-YYYY), Patente(opcional), Nota(opcional)
  Future<Map<String, dynamic>> importSchedule() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv', 'txt'],
      );

      if (result == null || result.files.isEmpty) {
        return {'success': false, 'message': 'No se seleccionó ningún archivo'};
      }

      final file = File(result.files.single.path!);
      final input = await file.readAsString();
      final rows = const CsvToListConverter().convert(input, eol: '\n');

      if (rows.isEmpty) {
        return {'success': false, 'message': 'El archivo está vacío'};
      }

      int imported = 0;
      int errors = 0;
      List<String> errorDetails = [];

      // Saltar cabecera si existe (asumimos que sí si la primera fila tiene texto 'Sucursal' o similar)
      int startIndex = 0;
      if (rows.isNotEmpty && rows[0].isNotEmpty && rows[0][0].toString().toLowerCase().contains('sucursal')) {
        startIndex = 1;
      }

      for (int i = startIndex; i < rows.length; i++) {
        final row = rows[i];
        if (row.isEmpty) continue;

        try {
          // Validar columnas mínimas
          if (row.length < 2) {
            throw Exception('Faltan columnas requeridas (Sucursal, Fecha)');
          }

          final branchCode = row[0].toString().trim();
          final dateStr = row[1].toString().trim();
          final plate = row.length > 2 ? row[2].toString().trim() : '';
          final notes = row.length > 3 ? row[3].toString().trim() : null;

          // Buscar sucursal
          final branches = await _db.getAllBranches(); // Podríamos optimizar con cache
          final branch = branches.cast<Branch?>().firstWhere(
            (b) => b?.code == branchCode,
            orElse: () => null,
          );

          if (branch == null) {
            throw Exception('Sucursal no encontrada: $branchCode');
          }

          // Parsear fecha DD-MM-YYYY
          final dateFormat = DateFormat('dd-MM-yyyy');
          DateTime scheduledDate;
          try {
            scheduledDate = dateFormat.parse(dateStr);
          } catch (e) {
            throw Exception('Formato de fecha inválido (use DD-MM-YYYY): $dateStr');
          }

          // Buscar o crear camión si hay patente
          String? truckId;
          if (plate.isNotEmpty) {
            final truck = await _db.getOrCreateTruck(plate, TruckType.carga);
            truckId = truck.id;
          }

          // Insertar programación
          await _db.insertSchedule(Schedule(
            branchId: branch.id!,
            scheduledDate: scheduledDate,
            truckId: truckId,
            status: truckId != null ? ScheduleStatus.assigned : ScheduleStatus.pending,
            notes: notes,
          ));

          imported++;
        } catch (e) {
          errors++;
          errorDetails.add('Fila ${i + 1}: $e');
        }
      }

      return {
        'success': true,
        'imported': imported,
        'errors': errors,
        'details': errorDetails,
      };

    } catch (e) {
      return {'success': false, 'message': 'Error crítico al importar: $e'};
    }
  }

  /// Genera una plantilla CSV de ejemplo
  Future<void> generateTemplate() async {
    // Implementación futura: Guardar archivo template en descargas
  }
}

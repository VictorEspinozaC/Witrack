
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:lector_patentes/config/supabase_config.dart';

void main() {
  test('Validar conexión a Supabase y lectura de datos', () async {
    // 1. Inicializar Supabase
    print('Iniciando conexión a: ${SupabaseConfig.url}');
    
    final supabase = SupabaseClient(
      SupabaseConfig.url, 
      SupabaseConfig.anonKey,
    );

    // 2. Intentar leer tabla 'branches'
    // Esta tabla tiene política "Anyone can view branches" (public read)
    try {
      final data = await supabase.from('branches').select().limit(5);
      
      print('✅ Conexión exitosa. Datos recibidos:');
      print(data);
      
      expect(data, isNotNull);
      // No validamos length > 0 porque podría estar vacía, pero si no lanza error es éxito.
      
    } catch (e) {
      print('❌ Error conectando a Supabase: $e');
      fail('Falló la conexión a Supabase');
    }
  });
}

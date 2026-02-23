/// Inicialización del factory de SQLite según plataforma.
/// En web no se usa; en escritorio (Windows/Linux/macOS) usa sqflite_common_ffi.
export 'init_database_factory_stub.dart'
    if (dart.library.ffi) 'init_database_factory_io.dart';

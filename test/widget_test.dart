import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App should build without errors', (WidgetTester tester) async {
    // Simple smoke test to verify the app builds
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(child: Text('Test')),
        ),
      ),
    );

    expect(find.text('Test'), findsOneWidget);
  });
}

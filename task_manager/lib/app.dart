import 'package:flutter/material.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/tasks/task_list_screen.dart';
import 'screens/tasks/task_detail_screen.dart';
import 'screens/profile/profile_screen.dart';

class TaskManagerApp extends StatelessWidget {
  const TaskManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Task Manager',
      debugShowCheckedModeBanner: false,

      // Giao diện chung
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      ),

      // Màn hình đầu tiên
      initialRoute: '/login',

      // Các đường dẫn cố định
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/tasks': (context) => const TaskListScreen(),
        '/profile': (context) => const ProfileScreen(),
      },

      // Xử lý đường dẫn có tham số
      onGenerateRoute: (settings) {
        if (settings.name == '/task-detail') {
          final taskId = settings.arguments;

          if (taskId is String && taskId.isNotEmpty) {
            return MaterialPageRoute(
              builder: (context) => TaskDetailScreen(
                taskId: taskId,
              ),
              settings: settings,
            );
          }
        }

        // Xử lý đường dẫn không hợp lệ
        return MaterialPageRoute(
          builder: (context) => Scaffold(
            appBar: AppBar(
              title: const Text('Không tìm thấy trang'),
            ),
            body: const Center(
              child: Text('Đường dẫn không hợp lệ'),
            ),
          ),
        );
      },
    );
  }
}

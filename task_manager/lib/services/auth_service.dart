
import '../models/user.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient _apiClient;

  AuthService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

// Đăng ký tài khoản - không tự lưu JWT Token
  Future<User> register({
    required String fullName,
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post(
      '/auth/register',
      {
        'fullName': fullName.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
      },
    );

    final userData = response['user'];

    if (userData is! Map) {
      throw Exception('Dữ liệu người dùng không hợp lệ');
    }

    return User.fromJson(
      Map<String, dynamic>.from(userData),
    );
  }

  // Đăng nhập
  Future<User> login({
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post(
      '/auth/login',
      {
        'email': email.trim().toLowerCase(),
        'password': password,
      },
    );

    return _handleAuthResponse(response);
  }

  // Xử lý kết quả đăng nhập và đăng ký
  // Lưu JWT Token và chuyển JSON thành User
  Future<User> _handleAuthResponse(
      Map<String, dynamic> response,
      ) async {
    final token = response['token'];
    final userData = response['user'];

    if (token is! String || token.isEmpty) {
      throw Exception('Backend không trả về JWT Token');
    }

    if (userData is! Map) {
      throw Exception('Dữ liệu người dùng không hợp lệ');
    }

    await _apiClient.saveToken(token);

    return User.fromJson(
      Map<String, dynamic>.from(userData),
    );
  }

  // Lấy thông tin người dùng hiện tại
  Future<User> getCurrentUser() async {
    final response = await _apiClient.get('/auth/me');

    final userData = response['user'];

    if (userData is! Map) {
      throw Exception('Không thể lấy thông tin người dùng');
    }

    return User.fromJson(
      Map<String, dynamic>.from(userData),
    );
  }
  // Cập nhật thông tin cá nhân
  Future<User> updateProfile({
    required String fullName,
    String? avatarUrl,
  }) async {
    final body = <String, dynamic>{
      'fullName': fullName.trim(),
    };

    if (avatarUrl != null) {
      body['avatarUrl'] = avatarUrl.trim();
    }

    final response = await _apiClient.put(
      '/auth/me',
      body,
    );

    final userData = response['user'];

    if (userData is! Map) {
      throw Exception('Dữ liệu người dùng không hợp lệ');
    }

    return User.fromJson(
      Map<String, dynamic>.from(userData),
    );
  }
  // Đổi mật khẩu
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _apiClient.put(
      '/auth/change-password',
      {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }
  // Kiểm tra thiết bị đã lưu Token hay chưa
  Future<bool> isLoggedIn() async {
    final token = await _apiClient.getToken();

    return token != null && token.isNotEmpty;
  }

  // Đăng xuất khỏi thiết bị
  Future<void> logout() async {
    await _apiClient.clearToken();
  }
}

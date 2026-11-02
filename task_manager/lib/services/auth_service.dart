
import '../models/user.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient _apiClient;

  AuthService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  // Đăng ký tài khoản
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

    return _handleAuthResponse(response);
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

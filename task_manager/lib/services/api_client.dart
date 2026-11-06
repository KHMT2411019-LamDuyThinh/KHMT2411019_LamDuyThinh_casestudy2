
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  // Địa chỉ Backend khi chạy trên Android Emulator
  static const String baseUrl = 'http://10.0.2.2:3000/api';

  final http.Client _client = http.Client();

  // Lưu JWT Token
  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  // Lấy JWT Token
  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  // Xóa JWT Token khi đăng xuất
  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  // Gửi GET Request
  Future<Map<String, dynamic>> get(
      String endpoint, {
        bool requireAuth = true,
      }) async {
    final token = await getToken();

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (requireAuth && token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final response = await _client.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
    );

    return _handleResponse(response);
  }
  // Gửi PUT Request
  Future<Map<String, dynamic>> put(
      String endpoint,
      Map<String, dynamic> body, {
        bool requireAuth = true,
      }) async {
    final token = await getToken();

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (requireAuth && token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final response = await _client.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );

    return _handleResponse(response);
  }
  // Gửi POST Request
  Future<Map<String, dynamic>> post(
      String endpoint,
      Map<String, dynamic> body, {
        bool requireAuth = false,
      }) async {
    final token = await getToken();

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (requireAuth && token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final response = await _client.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );

    return _handleResponse(response);
  }

  // Xử lý kết quả trả về từ Backend
  Map<String, dynamic> _handleResponse(
      http.Response response,
      ) {
    final responseBody = utf8.decode(response.bodyBytes);

    Map<String, dynamic> data;

    try {
      final decoded = jsonDecode(responseBody);

      if (decoded is Map) {
        data = Map<String, dynamic>.from(decoded);
      } else {
        throw const FormatException('Invalid API response');
      }
    } catch (error) {
      throw Exception(
        'Cannot read server response: ${response.statusCode}',
      );
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300) {
      throw Exception(
        data['message'] ?? 'API request failed',
      );
    }

    return data;
  }

  // Đóng HTTP Client khi không còn sử dụng
  void dispose() {
    _client.close();
  }
}

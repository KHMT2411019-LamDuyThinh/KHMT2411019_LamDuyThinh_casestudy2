
class User {
  final String id;
  final String fullName;
  final String email;
  final String avatarUrl;

  const User({
    required this.id,
    required this.fullName,
    required this.email,
    this.avatarUrl = '',
  });

  // Chuyển JSON từ Backend thành đối tượng User
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
    );
  }

  // Chuyển đối tượng User thành JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'email': email,
      'avatarUrl': avatarUrl,
    };
  }
}

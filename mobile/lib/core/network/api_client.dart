import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../network/api_exception.dart';
import '../storage/token_storage.dart';

class ApiClient {
  final http.Client _client = http.Client();

  Future<Map<String, String>> _headers() async {
    final token = await TokenStorage.getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> get(String url) async {
    try {
      final headers = await _headers();
      final response = await _client.get(Uri.parse(url), headers: headers);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(message: 'Sin conexión a internet. Verifique su red.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Error al conectar con el servidor: $e');
    }
  }

  Future<dynamic> post(String url, {Map<String, dynamic>? body}) async {
    try {
      final headers = await _headers();
      final response = await _client.post(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    } on SocketException {
      throw ApiException(message: 'Sin conexión a internet. Verifique su red.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Error al conectar con el servidor: $e');
    }
  }

  Future<dynamic> put(String url, {Map<String, dynamic>? body}) async {
    try {
      final headers = await _headers();
      final response = await _client.put(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    } on SocketException {
      throw ApiException(message: 'Sin conexión a internet. Verifique su red.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Error al conectar con el servidor: $e');
    }
  }

  Future<dynamic> delete(String url) async {
    try {
      final headers = await _headers();
      final response = await _client.delete(Uri.parse(url), headers: headers);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(message: 'Sin conexión a internet. Verifique su red.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Error al conectar con el servidor: $e');
    }
  }

  dynamic _processResponse(http.Response response) {
    dynamic jsonBody;
    try {
      jsonBody = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      jsonBody = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonBody;
    }

    final message = (jsonBody is Map<String, dynamic> && jsonBody['message'] != null)
        ? jsonBody['message'].toString()
        : 'Error inesperado del servidor (${response.statusCode})';

    final errors = (jsonBody is Map<String, dynamic> && jsonBody['errors'] is Map<String, dynamic>)
        ? jsonBody['errors'] as Map<String, dynamic>
        : null;

    if (response.statusCode == 401) {
      TokenStorage.clearAll();
      throw ApiException(
        message: 'Sesión expirada o no autorizada.',
        statusCode: 401,
      );
    }

    throw ApiException(
      message: message,
      statusCode: response.statusCode,
      errors: errors,
    );
  }
}


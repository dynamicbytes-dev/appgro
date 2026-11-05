import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../constants/api_endpoints.dart';
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

  ApiException _handleSocketException(String url) {
    return ApiException(
      message: 'No se pudo conectar al servidor (${ApiEndpoints.baseUrl}).\n'
          'Verifique el cable USB o toque el ícono de Ajustes (arriba a la derecha) para configurar la IP del servidor.',
    );
  }

  Future<dynamic> get(String url) async {
    try {
      final headers = await _headers();
      final response = await _client.get(Uri.parse(url), headers: headers);
      return _processResponse(response);
    } on SocketException {
      throw _handleSocketException(url);
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
      throw _handleSocketException(url);
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
      throw _handleSocketException(url);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(message: 'Error al conectar con el servidor: $e');
    }
  }

  Future<dynamic> patch(String url, {Map<String, dynamic>? body}) async {
    try {
      final headers = await _headers();
      final response = await _client.patch(
        Uri.parse(url),
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _processResponse(response);
    } on SocketException {
      throw _handleSocketException(url);
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
      throw _handleSocketException(url);
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

    throw ApiException(
      message: message,
      statusCode: response.statusCode,
      errors: errors,
    );
  }
}

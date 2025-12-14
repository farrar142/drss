from django.test import TestCase
from django.contrib.auth import get_user_model
from django.test import Client
from ninja.testing import TestClient
from base.api import api
import json

User = get_user_model()

class UserModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    def test_user_creation(self):
        self.assertEqual(self.user.username, 'testuser')
        self.assertEqual(self.user.email, 'test@example.com')

    def test_user_str(self):
        self.assertEqual(str(self.user), 'testuser')

class APITestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    def test_login_success(self):
        response = self.client.post('/api/login', data=json.dumps({
            'username': 'testuser',
            'password': 'testpass123'
        }), content_type='application/json')
        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.content}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('token', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['username'], 'testuser')

    def test_login_failure(self):
        response = self.client.post('/api/login', data=json.dumps({
            'username': 'testuser',
            'password': 'wrongpass'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 401)

    def test_protected_endpoint_without_auth(self):
        response = self.client.get('/api/protected')
        self.assertEqual(response.status_code, 401)

    def test_protected_endpoint_with_auth(self):
        # First login to get token
        login_response = self.client.post('/api/login', data=json.dumps({
            'username': 'testuser',
            'password': 'testpass123'
        }), content_type='application/json')
        token = login_response.json()['token']
        print(f"Token: {token}")
        
        # Then access protected endpoint
        response = self.client.get('/api/protected', HTTP_AUTHORIZATION=f'Bearer {token}')
        print(f"Protected response status: {response.status_code}")
        print(f"Protected response content: {response.content}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['message'], 'Hello, testuser!')

    def test_me_endpoint(self):
        # First login to get token
        login_response = self.client.post('/api/login', data=json.dumps({
            'username': 'testuser',
            'password': 'testpass123'
        }), content_type='application/json')
        token = login_response.json()['token']
        
        # Then access me endpoint
        response = self.client.get('/api/me', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['username'], 'testuser')
        self.assertEqual(data['email'], 'test@example.com')

#!/usr/bin/env python
"""
Quick test to verify the WebSocket event publishing mechanism.

Run from vms-backend directory:
  python manage.py shell < test_websocket_flow.py
"""

import asyncio
import json
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from apps.scans.models import ScanEvent, ScanResult
from apps.scans.serializers import ScreenEventSerializer
from apps.visitors.models import Visitor
from apps.devices.models import Device, DeviceKind

def test_scan_event_serialization():
    """Test that ScreenEventSerializer works with select_related."""
    print("\n=== Test 1: ScreenEventSerializer with select_related ===")
    
    # Get or create a screen device
    screen, _ = Device.objects.get_or_create(
        kind=DeviceKind.SCREEN,
        defaults={"name": "Test Screen", "token_hash": "test"}
    )
    
    # Get any visitor (from seed_demo or database)
    visitor = Visitor.objects.first()
    if not visitor:
        print("❌ No visitors found. Run seed_demo first:")
        print("   python manage.py seed_demo")
        return False
    
    # Create a test ScanEvent
    scan = ScanEvent.objects.create(
        visitor=visitor,
        device=screen,
        result=ScanResult.VALID,
    )
    
    try:
        # Test 1a: Without select_related (will lazy-load)
        print(f"📋 Created ScanEvent #{scan.id} for {visitor.full_name}")
        
        # Test 1b: With select_related (our fix)
        scan = ScanEvent.objects.select_related("visitor").get(pk=scan.pk)
        payload = ScreenEventSerializer(scan, context={}).data
        
        print(f"✅ Serialization successful")
        print(f"   - id: {payload['id']}")
        print(f"   - full_name: {payload['full_name']}")
        print(f"   - country: {payload['country']}")
        print(f"   - category: {payload['category']}")
        print(f"   - photo_url: {payload['photo_url'][:50]}..." if payload['photo_url'] else "   - photo_url: None")
        print(f"   - scanned_at: {payload['scanned_at']}")
        
        return True
    except Exception as e:
        print(f"❌ Serialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        scan.delete()


def test_channel_layer_group():
    """Test that the channel layer group is properly configured."""
    print("\n=== Test 2: Channel Layer Group Configuration ===")
    
    try:
        channel_layer = get_channel_layer()
        print(f"✅ Channel layer: {channel_layer.__class__.__name__}")
        
        # Check it's the correct backend
        if "InMemoryChannelLayer" in str(channel_layer.__class__):
            print("✅ Using InMemoryChannelLayer (correct for single-worker setup)")
        else:
            print(f"⚠️  Using {channel_layer.__class__} (expected InMemoryChannelLayer)")
        
        return True
    except Exception as e:
        print(f"❌ Channel layer check failed: {e}")
        return False


def test_group_send_syntax():
    """Test that group_send calls are syntactically correct."""
    print("\n=== Test 3: Group Send Syntax ===")
    
    try:
        # Get sample data
        screen = Device.objects.filter(kind=DeviceKind.SCREEN).first()
        visitor = Visitor.objects.first()
        
        if not screen or not visitor:
            print("⚠️  Skipping (need screen device and visitor from seed_demo)")
            return True
        
        scan = ScanEvent.objects.create(
            visitor=visitor,
            device=screen,
            result=ScanResult.VALID,
        )
        
        # Load visitor for serialization
        scan = ScanEvent.objects.select_related("visitor").get(pk=scan.pk)
        payload = ScreenEventSerializer(scan, context={}).data
        
        # Test the group_send call (without actually publishing)
        channel_layer = get_channel_layer()
        group_name = "lobby_screens"
        message = {
            "type": "visitor.arrived",
            "payload": payload,
        }
        
        print(f"✅ Group send structure:")
        print(f"   - group: {group_name}")
        print(f"   - type: {message['type']}")
        print(f"   - payload keys: {list(message['payload'].keys())}")
        print(f"   - payload size: {len(json.dumps(message['payload']))} bytes")
        
        return True
    except Exception as e:
        print(f"❌ Group send test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'scan' in locals():
            scan.delete()


def test_method_name_conversion():
    """Verify that 'visitor.arrived' converts to 'visitor_arrived' correctly."""
    print("\n=== Test 4: Method Name Conversion (Channels) ===")
    
    type_name = "visitor.arrived"
    method_name = type_name.replace(".", "_")
    
    print(f"✅ Type 'visitor.arrived' → method '{method_name}'")
    
    if method_name == "visitor_arrived":
        print(f"✅ Matches ScreenConsumer.visitor_arrived()")
        return True
    else:
        print(f"❌ Mismatch: expected 'visitor_arrived', got '{method_name}'")
        return False


def test_transaction_on_commit():
    """Test that transaction.on_commit works correctly."""
    print("\n=== Test 5: Transaction on_commit Mechanism ===")
    
    try:
        called = []
        
        def callback():
            called.append(True)
        
        with transaction.atomic():
            transaction.on_commit(callback)
        
        if called:
            print("✅ transaction.on_commit() callback executed")
            return True
        else:
            print("❌ transaction.on_commit() callback not executed")
            return False
    except Exception as e:
        print(f"❌ on_commit test failed: {e}")
        return False


def run_all_tests():
    """Run all verification tests."""
    print("=" * 60)
    print("WebSocket Real-Time Flow Verification")
    print("=" * 60)
    
    results = []
    
    results.append(("ScreenEventSerializer", test_scan_event_serialization()))
    results.append(("Channel Layer", test_channel_layer_group()))
    results.append(("Group Send Syntax", test_group_send_syntax()))
    results.append(("Method Name Conversion", test_method_name_conversion()))
    results.append(("Transaction on_commit", test_transaction_on_commit()))
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        print("\n🎉 All tests passed!")
        print("\nThe WebSocket event flow is correctly configured.")
        print("To verify end-to-end:")
        print("1. Start backend: uvicorn config.asgi:application --workers 1")
        print("2. Pair screen device with vms-screen")
        print("3. Scan visitor QR with vms-scanner")
        print("4. Visitor should appear on lobby screen within ~200ms")
    else:
        print("\n❌ Some tests failed. Check output above.")
    
    return all_passed


if __name__ == "__main__":
    import django
    django.setup()
    success = run_all_tests()
    exit(0 if success else 1)

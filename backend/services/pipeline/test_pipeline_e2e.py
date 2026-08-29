"""
End-to-end pipeline integration test.
Run with: python test_pipeline_e2e.py
"""
import urllib.request
import urllib.error
import json
import time
import os

BACKEND = "http://localhost:5000"
TEST_PDF = os.path.join(os.path.dirname(__file__), "test_land_record.pdf")

def upload_pdf(path, engine="paddleocr"):
    print(f"\n=== STEP 1: Upload PDF to POST {BACKEND}/api/documents ===")
    boundary = "TerminalBoundary99887766"
    with open(path, "rb") as f:
        file_data = f.read()

    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_land_record.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode("utf-8")
    footer = f"\r\n--{boundary}--\r\n".encode("utf-8")
    body = header + file_data + footer

    req = urllib.request.Request(
        f"{BACKEND}/api/documents?engine={engine}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read())
        print(f"  HTTP 202 - Job created")
        print(json.dumps(result, indent=2))
        return result.get("job_id")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  HTTP {e.code} - Upload failed: {body}")
        return None
    except Exception as e:
        print(f"  UPLOAD FAILED: {e}")
        return None


def poll_status(job_id, max_polls=30, interval=2):
    print(f"\n=== STEP 2: Polling /api/jobs/{job_id} ===")
    for i in range(max_polls):
        time.sleep(interval)
        try:
            with urllib.request.urlopen(f"{BACKEND}/api/jobs/{job_id}", timeout=8) as resp:
                status = json.loads(resp.read())
        except Exception as e:
            print(f"  [{i+1}] Poll error: {e}")
            continue

        print(
            f"  [{i+1:02d}] status={status['status']:12s} "
            f"progress={status['progress']:3d}% "
            f"msg={status.get('message','')}"
        )
        if status["status"] in ("completed", "failed"):
            return status["status"]
    return "timeout"


def get_results(job_id):
    print(f"\n=== STEP 3: GET /api/jobs/{job_id}/results ===")
    try:
        with urllib.request.urlopen(f"{BACKEND}/api/jobs/{job_id}/results", timeout=10) as resp:
            results = json.loads(resp.read())
        print(json.dumps(results, indent=2))
        return results
    except Exception as e:
        print(f"  GET RESULTS FAILED: {e}")
        return None


def summarize(results):
    if not results:
        return
    print("\n=== SUMMARY ===")
    recs = results.get("results", {})
    records = recs.get("records", []) if recs else []
    discarded = recs.get("discarded_logs", []) if recs else []
    print(f"  Records returned : {len(records)}")
    print(f"  Discarded dups   : {len(discarded)}")
    for r in records:
        rec = r.get("record") or {}
        print(f"  Page {r.get('page_number')}: "
              f"owner={rec.get('owner_name', {}).get('value', '?')} "
              f"survey={rec.get('survey_number', {}).get('value', '?')} "
              f"valid={r.get('isValid')} "
              f"conf={r.get('aggregate_confidence', 0):.2f}")
    for f in records:
        if f.get("status") == "failed":
            print(f"  FAILED page {f.get('page_number')}: {f.get('error')}")


if __name__ == "__main__":
    # Use the 2-page PDF: page 1 = cover_page (skipped), page 2 = record_entry (extracted)
    TEST_PDF = os.path.join(os.path.dirname(__file__), "test_land_record_2page.pdf")
    job_id = upload_pdf(TEST_PDF, engine="gemini")
    if not job_id:
        print("\nABORTED: Could not create job.")
        exit(1)

    final_status = poll_status(job_id, max_polls=30, interval=2)
    print(f"\n  Final job status: {final_status.upper()}")

    results = get_results(job_id)
    summarize(results)

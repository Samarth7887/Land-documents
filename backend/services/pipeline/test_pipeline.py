import asyncio
from orchestrator import batch_pages, merge_overlapping_records

def test_batching():
    print("=== Test 1: Page Batching with 2-Page Overlap ===")
    pages = [
        (2, "page_2.png"), (3, "page_3.png"), (4, "page_4.png"),
        (5, "page_5.png"), (6, "page_6.png"), (7, "page_7.png")
    ]
    
    # Batch size = 3, overlap = 1
    batches_1 = batch_pages(pages, batch_size=3, overlap=1)
    print("Batch size 3, overlap 1 result:")
    for idx, b in enumerate(batches_1):
        p_nums = [p[0] for p in b]
        print(f"  Batch {idx+1}: {p_nums}")
        
    assert len(batches_1) == 3, "Expected 3 batches"
    assert [p[0] for p in batches_1[0]] == [2, 3, 4]
    assert [p[0] for p in batches_1[1]] == [4, 5, 6]
    assert [p[0] for p in batches_1[2]] == [6, 7]
    print(" -> Batching validation: PASS")

def test_merging():
    print("\n=== Test 2: Record Merging by Aggregate Confidence ===")
    
    # Simulating duplicate records extracted on page 3 (higher confidence) and page 4 (lower confidence)
    records = [
        {
            "page_number": 3,
            "status": "success",
            "record": {
                "owner_name": {"value": "Johnathan Smith", "confidence": 0.95},
                "survey_number": {"value": "404-B / Part 2", "confidence": 0.90},
                "village": {"value": "Green Valley", "confidence": 0.95}
            }
        },
        {
            "page_number": 4,
            "status": "success",
            "record": {
                "owner_name": {"value": "Jonathan Smith", "confidence": 0.55}, # low conf typo
                "survey_number": {"value": "404-B / Part 2", "confidence": 0.70},
                "village": {"value": "Green Valley", "confidence": 0.80}
            }
        }
    ]
    
    merged, logs = merge_overlapping_records(records)
    
    print("\nLogs recorded during merging:")
    for log in logs:
        print(f"  {log}")
        
    assert len(merged) == 1, "Expected duplicate records to merge into 1"
    assert merged[0]["page_number"] == 3, "Expected to keep record from page 3 due to higher confidence"
    print("\n -> Merging validation: PASS")

if __name__ == "__main__":
    test_batching()
    test_merging()

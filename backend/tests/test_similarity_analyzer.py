from app.services.similarity_analyzer import compute_uniqueness, hamming_distance, signature_distance


def test_hamming_distance_identical_is_zero():
    assert hamming_distance(0b1010, 0b1010) == 0


def test_hamming_distance_counts_differing_bits():
    assert hamming_distance(0b0000, 0b1111) == 4


def test_compute_uniqueness_single_hash_is_fully_unique():
    scores, duplicates = compute_uniqueness([12345])

    assert scores == [100.0]
    assert duplicates == [False]


def test_compute_uniqueness_identical_hashes_flagged_as_duplicates():
    scores, duplicates = compute_uniqueness([0b1111, 0b1111])

    assert scores == [0.0, 0.0]
    assert duplicates == [True, True]


def test_compute_uniqueness_distant_hashes_are_not_duplicates():
    scores, duplicates = compute_uniqueness([0b0000_0000, 0b1111_1111], full_score_distance=8)

    assert scores == [100.0, 100.0]
    assert duplicates == [False, False]


def test_multiframe_signature_compares_aligned_representative_frames():
    assert signature_distance((0, 0, 0), (0, 0, 0)) == 0
    assert signature_distance((0, 0, 0), (0, 0, 7)) == 1.0


def test_bk_tree_uniqueness_matches_brute_force_for_signatures():
    from app.services.similarity_analyzer import _BKTree

    signatures = [(index, index * 3, index * 7) for index in range(40)]
    tree = _BKTree(signatures)
    for signature in signatures:
        matches = tree.within(signature, 48)
        expected = [other for other in signatures if sum(
            hamming_distance(a, b) for a, b in zip(signature, other)
        ) <= 48]
        assert set(matches) == set(expected)

DEFAULT_UNIQUENESS_FULL_SCORE_DISTANCE = 16
DEFAULT_DUPLICATE_DISTANCE_THRESHOLD = 5


def hamming_distance(hash_a: int, hash_b: int) -> int:
    return bin(hash_a ^ hash_b).count("1")


def compute_uniqueness(
    hashes: list[int],
    full_score_distance: int = DEFAULT_UNIQUENESS_FULL_SCORE_DISTANCE,
    duplicate_distance_threshold: int = DEFAULT_DUPLICATE_DISTANCE_THRESHOLD,
) -> tuple[list[float], list[bool]]:
    """For each hash, finds the hamming distance to its closest neighbour.

    Returns (uniqueness_scores, is_duplicate_flags):
    - uniqueness_score (0-100): scales linearly from 0 (identical to another
      clip) to 100 (distance >= full_score_distance).
    - is_duplicate: True if the closest neighbour is within
      `duplicate_distance_threshold` bits, i.e. "highly similar".

    A single clip (nothing to compare against) is always fully unique.
    """
    n = len(hashes)
    uniqueness_scores: list[float] = []
    is_duplicate: list[bool] = []

    for i in range(n):
        if n <= 1:
            uniqueness_scores.append(100.0)
            is_duplicate.append(False)
            continue

        min_distance = min(
            hamming_distance(hashes[i], hashes[j]) for j in range(n) if j != i
        )
        uniqueness = max(0.0, min(100.0, (min_distance / full_score_distance) * 100.0))
        uniqueness_scores.append(uniqueness)
        is_duplicate.append(min_distance <= duplicate_distance_threshold)

    return uniqueness_scores, is_duplicate

from collections.abc import Sequence

DEFAULT_UNIQUENESS_FULL_SCORE_DISTANCE = 16
DEFAULT_DUPLICATE_DISTANCE_THRESHOLD = 5


def hamming_distance(hash_a: int, hash_b: int) -> int:
    return bin(hash_a ^ hash_b).count("1")


def _hash_sequence(signature: int | Sequence[int]) -> tuple[int, ...]:
    return (signature,) if isinstance(signature, int) else tuple(signature)


def signature_distance(signature_a: int | Sequence[int], signature_b: int | Sequence[int]) -> float:
    """Average aligned-frame Hamming distance; integers remain 64-bit compatible."""
    hashes_a = _hash_sequence(signature_a)
    hashes_b = _hash_sequence(signature_b)
    if not hashes_a or not hashes_b:
        return 64.0
    if len(hashes_a) != len(hashes_b):
        return float(hamming_distance(hashes_a[0], hashes_b[0]))
    return sum(hamming_distance(a, b) for a, b in zip(hashes_a, hashes_b)) / len(hashes_a)


def _signature_metric(signature_a: int | Sequence[int], signature_b: int | Sequence[int]) -> int:
    """Integer Hamming metric for BK-tree indexing of aligned signatures."""
    a, b = _hash_sequence(signature_a), _hash_sequence(signature_b)
    if len(a) != len(b):
        return hamming_distance(a[0], b[0])
    return sum(hamming_distance(left, right) for left, right in zip(a, b))


class _BKNode:
    def __init__(self, value: int | Sequence[int]):
        self.value = _hash_sequence(value)
        self.children: dict[int, _BKNode] = {}


class _BKTree:
    """Hamming-radius lookup avoids comparing every clip with every other clip."""
    def __init__(self, values=()):
        self.root: _BKNode | None = None
        for value in values:
            self.add(value)

    def add(self, value: int | Sequence[int]) -> None:
        node = _BKNode(value)
        if self.root is None:
            self.root = node
            return
        current = self.root
        while True:
            distance = _signature_metric(node.value, current.value)
            if distance == 0:
                return
            child = current.children.get(distance)
            if child is None:
                current.children[distance] = node
                return
            current = child

    def within(self, value: int | Sequence[int], radius: int) -> list[tuple[int, ...]]:
        if self.root is None or radius < 0:
            return []
        target = _hash_sequence(value)
        matches: list[tuple[int, ...]] = []
        pending = [self.root]
        while pending:
            node = pending.pop()
            distance = _signature_metric(target, node.value)
            if distance <= radius:
                matches.append(node.value)
            pending.extend(child for edge, child in node.children.items()
                           if distance - radius <= edge <= distance + radius)
        return matches


def compute_uniqueness(
    hashes: list[int | Sequence[int]],
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
    tree = _BKTree(hashes)
    counts: dict[tuple[int, ...], int] = {}
    for value in hashes:
        key = _hash_sequence(value)
        counts[key] = counts.get(key, 0) + 1

    for i in range(n):
        if n <= 1:
            uniqueness_scores.append(100.0)
            is_duplicate.append(False)
            continue

        key = _hash_sequence(hashes[i])
        nearby = tree.within(hashes[i], full_score_distance * len(key))
        min_distance = (min(signature_distance(hashes[i], other) for other in nearby
                            if other != key or counts[key] > 1)
                        if any(other != key or counts[key] > 1 for other in nearby)
                        else float(full_score_distance))
        uniqueness = max(0.0, min(100.0, (min_distance / full_score_distance) * 100.0))
        uniqueness_scores.append(uniqueness)
        is_duplicate.append(min_distance <= duplicate_distance_threshold)

    return uniqueness_scores, is_duplicate

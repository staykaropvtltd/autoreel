import uuid

from app.schemas.batch import BatchClip, BatchAnalysisResult


def ensure_analysis_clip_ids(analysis_job_id: str, result: BatchAnalysisResult) -> None:
    """Assign stable, job-scoped IDs to every clip in the stored analysis."""
    namespace = uuid.UUID(analysis_job_id)
    for index, clip in enumerate(result.all_clips):
        if clip.clip_id is not None:
            continue
        identity = "\0".join(
            (
                str(index),
                clip.source_file,
                format(clip.start_time, ".9f"),
                format(clip.end_time, ".9f"),
                clip.perceptual_hash,
            )
        )
        clip.clip_id = uuid.uuid5(namespace, identity)


def clips_by_id(clips: list[BatchClip]) -> dict[uuid.UUID, BatchClip]:
    return {clip.clip_id: clip for clip in clips if clip.clip_id is not None}

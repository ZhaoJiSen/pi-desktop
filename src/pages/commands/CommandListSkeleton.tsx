import { SkeletonBar } from '../../components/loading/SkeletonBar'

export function CommandListSkeleton() {
  return (
    <div className="workspace-skeleton-rows" aria-hidden="true">
      <div className="commands-group-heading">
        <SkeletonBar width="80px" />
      </div>
      {[72, 58, 84, 66, 78].map((width) => (
        <div className="command-row sidebar-option" key={width}>
          <div className="workspace-skeleton-copy">
            <SkeletonBar width={`${width}%`} />
            <SkeletonBar width="88%" />
          </div>
        </div>
      ))}
    </div>
  )
}

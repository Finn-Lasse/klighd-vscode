/* eslint-disable no-continue */
/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2022-2025 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */

/** @jsx html */
import { KGraphData } from '@kieler/klighd-interactive/lib/constraint-classes'
import { inject, injectable, postConstruct } from 'inversify'
import { VNode } from 'snabbdom'
import {
    AbstractUIExtension,
    html, // eslint-disable-line @typescript-eslint/no-unused-vars
    IActionDispatcher,
    isThunk,
    MouseTool,
    Patcher,
    PatcherProvider,
    SGraphImpl,
    TYPES,
    ViewerOptions,
} from 'sprotty'
import { Bounds, Point } from 'sprotty-protocol'
import { RenderOptionsRegistry } from '../options/render-options-registry'
import { SKGraphModelRenderer } from '../skgraph-model-renderer'
import { SKEdge, SKLabel, SKNode } from '../skgraph-models'
import { getCanvasBounds} from '../skgraph-utils'
import { getKRendering} from '../views-common'
import { ProxyFilter, ProxyFilterAndID } from './filters/proxy-view-filters'
import { SendProxyViewAction, ShowProxyViewAction } from './proxy-view-actions'
import {
    ProxyViewCapScaleToOne,
    ProxyViewEnabled,
    ProxyViewHighlightSelected,
    ProxyViewInteractiveProxies,
    ProxyViewOriginalNodeScale,
    ProxyViewSize,
    ProxyViewTitleScaling,
    ProxyViewTransparentEdges,
    ProxyViewUseSynthesisProxyRendering,
} from './proxy-view-options'
import {
    Canvas,
    isInBounds,
    isSelectedOrConnectedToSelected,
    getProxyId,
    ProxyKGraphData,
    ProxyVNode,
    TransformAttributes,
    updateClickThrough,
    updateOpacity,
    updateTransform,
    asBounds,
} from './proxy-view-util'
import{
    getBoundsFromPoints,
    getValueAt,
    Crossing,
    CrossingPoint,
    computeCubic,
    Sides,
    Anchors
} from './proxy-view-bezier'
/* global document, HTMLElement, MouseEvent */

/** A UIExtension which adds a proxy-view to the Sprotty container. */
@injectable()
export class ProxyView extends AbstractUIExtension {
    /** ID. */
    static readonly ID = 'proxy-view'

    /**
     * ID used to indicate whether an SKNode should be rendered as a proxy.
     * The corresponding property can be `true` or `false`.
     */
    static readonly RENDER_NODE_AS_PROXY_PROPERTY = 'de.cau.cs.kieler.klighd.proxyView.renderNodeAsProxy'

    /**
     * ID used for proxy rendering property of SKNodes.
     * The corresponding property contains the proxy's data.
     */
    static readonly PROXY_RENDERING_PROPERTY = 'de.cau.cs.kieler.klighd.proxyView.proxyRendering'

    /**
     * ID used for specifying depth of going into hierarchical off-screen nodes.
     * `0` indicates default behavior, showing only the outermost node as a proxy.
     * A value `x>0` indicates showing proxies up to x layers deep inside a hierarchical node.
     * A value `x<0` indicates always showing proxies for all layers.
     */
    static readonly HIERARCHICAL_OFF_SCREEN_DEPTH = 'de.cau.cs.kieler.klighd.proxyView.hierarchicalOffScreenDepth'

    /** Number indicating at what distance a node is close. */ // TODO: could let the synthesis define the distance values
    static readonly DISTANCE_CLOSE = 300

    /** Number indicating at what distance a node is distant. */
    static readonly DISTANCE_DISTANT = 700

    /** ActionDispatcher mainly needed for init(). */
    @inject(TYPES.IActionDispatcher) private actionDispatcher: IActionDispatcher

    /** Provides the utensil to replace HTML elements. */
    @inject(TYPES.PatcherProvider) private patcherProvider: PatcherProvider

    @inject(TYPES.ViewerOptions) private viewerOptions: ViewerOptions

    /** Used to replace HTML elements. */
    private patcher: Patcher

    /** VNode of the current HTML root element. Used by the {@link patcher}. */
    private currHTMLRoot: VNode

    /** The mouse tool to decorate the proxy nodes with. */
    @inject(MouseTool) mouseTool: MouseTool

    /** The registered filters. */
    private filters: Map<string, ProxyFilter>

    /** The currently rendered proxies. */
    private currProxies: { proxy: VNode; transform: TransformAttributes }[]

    /** Whether the proxies should be click-through. */
    private clickThrough: boolean

    /**
     * Stores the previous opacity of edges whose opacity was modified.
     * Always make sure the ids from {@link getProxyId()} are used.
     */
    private prevModifiedEdges: Map<string, [SKEdge, number]>

    /// / Caches ////
    /**
     * Stores the proxy renderings of already rendered nodes.
     * Always make sure the ids from {@link getProxyId()} are used.
     */
    private renderings: Map<string, ProxyVNode>

    /**
     * Stores the distances of nodes to the canvas.
     * Always make sure the ids from {@link getProxyId()} are used.
     */
    private distances: Map<string, number>

    /// / Sidebar options ////
    /** @see {@link ProxyViewEnabled} */
    private proxyViewEnabled: boolean

    /** Whether the proxy view was previously enabled. Used to avoid excessive patching. */
    private prevProxyViewEnabled: boolean

    /** @see {@link ProxyViewSize} */
    private sizePercentage: number

    /** @see {@link ProxyViewInteractiveProxies} */
    private interactiveProxiesEnabled: boolean

    /** @see {@link ProxyViewTitleScaling} */
    private titleScalingEnabled: boolean

    /// / Sidebar debug options ////
    /**
     * Note that clusters are never highlighted, as highlighting is synthesis-specific while cluster renderings are not.
     * @see {@link ProxyViewHighlightSelected}
     */
    private highlightSelected: boolean

    /** @see {@link ProxyViewUseSynthesisProxyRendering} */
    private useSynthesisProxyRendering: boolean

    /** @see {@link ProxyViewTransparentEdges} */
    private transparentEdges: boolean

    /** @see {@link ProxyViewOriginalNodeScale} */
    private originalNodeScale: boolean

    /** @see {@link ProxyViewCapScaleToOne} */
    private capScaleToOne: boolean


    id(): string {
        return ProxyView.ID
    }

    containerClass(): string {
        return ProxyView.ID
    }

    @postConstruct()
    init(): void {
        // Send and show proxy-view
        this.actionDispatcher.dispatch(SendProxyViewAction.create(this))
        this.actionDispatcher.dispatch(ShowProxyViewAction.create())
        this.patcher = this.patcherProvider.patcher
        // Initialize caches
        this.filters = new Map()
        this.currProxies = []
        this.prevModifiedEdges = new Map()
        this.renderings = new Map()
        this.distances = new Map()
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // Use temp for initializing currHTMLRoot
        const temp = document.createElement('div')
        this.currHTMLRoot = this.patcher(temp, <div />)
        containerElement.appendChild(temp)
    }

    /// ///// Main methods ////////

    /**
     * Update step of the proxy-view. Handles everything proxy-view related.
     * @param model The current SGraph.
     * @param ctx The rendering context.
     */
    update(model: SGraphImpl, ctx: SKGraphModelRenderer): void {
        if (!this.proxyViewEnabled) {
            if (this.prevProxyViewEnabled) {
                // Prevent excessive patching, only patch if disabled just now
                this.currHTMLRoot = this.patcher(this.currHTMLRoot, <div />)
                this.prevProxyViewEnabled = this.proxyViewEnabled
            }
            return
        }
        if (!this.currHTMLRoot) {
            return
        }

        const canvasWidth = model.canvasBounds.width
        const canvasHeight = model.canvasBounds.height
        const canvas = Canvas.of(model, ctx.viewport)
        const root = model.children[0] as SKNode
        // Actually update the document
        this.currHTMLRoot = this.patcher(
            this.currHTMLRoot,
            <svg
                style={{
                    // Set size to whole canvas
                    width: `${canvasWidth}`,
                    height: `${canvasHeight}`,
                }}
            >
                {...this.createAllProxies(root, ctx, canvas)}
            </svg>
        )
    }

    /** Returns the proxy rendering for all of currRoot's off-screen children and applies logic, e.g. clustering. */
    private createAllProxies(root: SKNode, ctx: SKGraphModelRenderer, canvas: Canvas): VNode[] {
        // Iterate through nodes starting by root, check if node is:
        // (partially) in bounds -> no proxy, check children
        // out of bounds         -> proxy

        // Translate canvas to both Reference Frames
        const canvasVRF = Canvas.translateCanvasToVRF(canvas)
        const canvasCRF = Canvas.translateCanvasToCRF(canvas)

        /// / Initial nodes ////

        const crossingEdges = this.getPossibleEdges(root, canvasCRF)

        const crossings = this.getCrossings(crossingEdges, canvasCRF, ctx)

        this.updateProxyPlacementPoints(crossings, canvasCRF)
 
        this.applyAnchors(crossings, canvasCRF)

        const filteredOverlaps = this.filterOverlappingWithNodes(crossings, root, canvasCRF)

        this.getCrossingTransform(filteredOverlaps, canvasVRF)

        const proxies = []
        this.currProxies = []

        let idNr = 1
        // Nodes
        for (const crossing of filteredOverlaps) {
            for (const cp of crossing.crossingPoints){
                // Create a proxy
                const transform = cp.nodeBounds as TransformAttributes

                if (cp.node !== undefined){
                    const proxy = this.createProxy(cp.node, transform, ctx, idNr)
                    idNr += 1
                    if (proxy) {
                        proxies.push(proxy)
                        this.currProxies.push({ proxy, transform })
                    }
                }
            }
        }

        // Clear caches for the next model
        this.clearDistances()

        return proxies
    }


    private filterOverlappingWithNodes(crossings: Crossing[], root: SKNode, canvasCRF: Canvas): Crossing[]{
        const nodes = this.getTreeDepths(root)
        const result = []

        for (const crossing of crossings){
            const edge = crossing.edge
            let depth
            if (edge.target instanceof SKNode && edge.source instanceof SKNode){
                const depthTarget = this.getDepth(edge.target, root)
                const depthSource = this.getDepth(edge.source, root)
                depth = Math.max(depthSource, depthTarget)
            }

            const filtered = []
            for (const cp of crossing.crossingPoints){
                depth ??= this.getDepth(cp.node, root)
                let foundOverlap = false
                for (let i = depth; i < nodes.length && !foundOverlap; i++){
                    const {proxyWidth, proxyHeight} = this.transformWidthHeight(cp.nodeBounds, canvasCRF)
                    const cpBounds = {x: cp.proxyPoint.x, y: cp.proxyPoint.y, width: proxyWidth, height: proxyHeight}

                    for (let j = 0; j < nodes[i].length && !foundOverlap; j++){
                        let b: Bounds = {x: nodes[i][j].properties.absoluteX as number, y: nodes[i][j].properties.absoluteY as number, width: nodes[i][j].bounds.width, height: nodes[i][j].bounds.height}
                        if (isInBounds(cpBounds, b)){
                            foundOverlap = true
                        }
                    }
                }
                if (!foundOverlap){
                    filtered.push(cp)
                }
            }
            if (filtered.length > 0){
                crossing.crossingPoints = filtered
                result.push(crossing)
            }
        }
        return result
    }

    private getTreeDepths(currRoot: SKNode): SKNode[][] {
        const res: SKNode[][] = []

        let currentRow = [currRoot]
        while (currentRow.length > 0){
            res.push(currentRow)
            let nextRow = []

            for (const node of currentRow) {
                for (const child of node.children){
                    if(child instanceof SKNode){
                        nextRow.push(child)
                    }
                }
            }
            currentRow = nextRow
        }
        return res
    }

    private getDepth(node: SKNode, root: SKNode): number{
        if (node != root && node.parent instanceof SKNode){
            return 1 + this.getDepth(node.parent, root)
        }else{
            return 0
        }
    }

    private applyAnchors(crossings: Crossing[], canvas: Canvas) : void{
        for (const crossing of crossings){
            for (const cp of crossing.crossingPoints){
                const {proxyWidth, proxyHeight} = this.transformWidthHeight(cp.nodeBounds, canvas)
                const bounds = {x :0, y:0, width: proxyWidth, height: proxyHeight}
                const {offsetx, offsety} = this.getAnchorOffsets(bounds, cp.side, cp.anchor)
                cp.proxyPoint.x -= offsetx
                cp.proxyPoint.y -= offsety
                cp.anchor = Anchors.topLeft
            }
        }
    }

    private transformWidthHeight(proxyBounds: Bounds, canvas: Canvas): {proxyWidth: number, proxyHeight: number, scale: number} {
        // Calculate the scale and the resulting proxy dimensions
        // The scale is calculated such that width & height are capped to a max value

        // Calculate size of proxies
        const size = Math.min(canvas.width, canvas.height) * this.sizePercentage

        const proxyWidthScale = size / proxyBounds.width
        const proxyHeightScale = size / proxyBounds.height
        let scale = this.originalNodeScale ? canvas.zoom : Math.min(proxyWidthScale, proxyHeightScale)
        scale = this.capScaleToOne ? Math.min(1, scale) : scale
        const proxyWidth = proxyBounds.width * scale
        const proxyHeight = proxyBounds.height * scale
        return {proxyWidth: proxyWidth, proxyHeight: proxyHeight, scale}
    }
    /**
     * Calculates the TransformAttributes for this node's proxy, e.g. the position to place the proxy at aswell as its scale and bounds.
     * Note that the position is pre-scaling. To get position post-scaling, divide `x` and `y` by `scale`.
     */
    private getTransform(point: Point, proxyBounds: Bounds, canvas: Canvas): TransformAttributes {
        const {proxyWidth, proxyHeight, scale} = this.transformWidthHeight(proxyBounds, canvas)

        const translated = Canvas.translateToVRF(point, canvas)

        // Cap proxy to canvas
        // ;({ x, y } = Canvas.capToCanvas({ x, y, width: proxyWidth, height: proxyHeight }, canvas))

        return { x: translated.x, y: translated.y, scale, width: proxyWidth, height: proxyHeight }
    }


    private getCrossingTransform(
        crossings: Crossing[],
        canvasVRF: Canvas,
    ): void{
        for (const crossing of crossings){
            for (const cp of crossing.crossingPoints){
                if (cp.node){
                    cp.nodeBounds = this.getTransform(cp.proxyPoint, cp.nodeBounds, canvasVRF)
                }
            }
        }
    }


    private getPossibleEdges(
        currRoot: SKNode,
        canvasCRF: Canvas,
    ): SKEdge[] {
        const proxyEdges: SKEdge[] = []
        for (const child of currRoot.children) {
            if (child instanceof SKEdge) {
                const bounds = getCanvasBounds(child)
                
                if (this.isCrossingBounds(bounds, canvasCRF)) {
                    proxyEdges.push(child)
                }
            }
            else if(child instanceof SKNode){
                    if (child.children.length > 0) {
                        const childrenProxyEdges = this.getPossibleEdges(child, canvasCRF)
                        proxyEdges.push(...childrenProxyEdges)
                    }
            }
        }
        return proxyEdges
    }

    

    private getCrossings(
        proxyEdges: SKEdge[],
        canvasCRF: Canvas,
        ctx: SKGraphModelRenderer
    ): Crossing[] {
        
        const crossings: Crossing[] = []

        for (const edge of proxyEdges) {

            const edgeBounds = getCanvasBounds(edge)
            const offsetx = edgeBounds.x - edge.bounds.x
            const offsety = edgeBounds.y - edge.bounds.y

            const rpointsWithoutOffset = edge.routingPoints
            const rpoints = rpointsWithoutOffset.map(p => ({x:p.x + offsetx , y: p.y + offsety}));

            const pointBounds: Bounds[] = []
            const bezierPoints: Point[][] = []

            const newCrossings: CrossingPoint[] = []

            if (rpoints.length % 3 == 1 && rpoints.length >= 4){
                for(let i = 0; i  < Math.floor(rpoints.length/3); i++){
                    const bpoints = rpoints.slice(i*3, i*3 + 4)
                    pointBounds.push(getBoundsFromPoints(bpoints))
                    bezierPoints.push(bpoints)
                }

                for (let i = 0; i < pointBounds.length; i++){
                    const pointBound = pointBounds[i]
                    const bPoints: Point[] = bezierPoints[i]

                    if (this.isCrossingBounds(pointBound, canvasCRF)){
                        const b1 = pointBound
                        const b2 = canvasCRF

                        let cPoints: {point: Point, t: number, side: Sides}[] = []

                        if ((b1.x <= b2.x && b1.x + b1.width >= b2.x)) {
                            const a = getValueAt(b2.x, bPoints, 0)
                            const c = a.map(p => ({...p, side:Sides.W}))
                            cPoints.push(...c)
                        }
                        if ((b1.x <= b2.x + b2.width && b1.x + b1.width >= b2.x + b2.width)) {
                            const a = getValueAt(b2.x + b2.width, bPoints, 0)
                            const c = a.map(p => ({...p, side:Sides.E}))
                            cPoints.push(...c)
                        }
                        if ((b1.y <= b2.y && b1.y + b1.height >= b2.y)) {
                            const a = getValueAt(b2.y, bPoints, 1)
                            const c = a.map(p => ({...p, side:Sides.N}))
                            cPoints.push(...c)
                        }
                        if ((b1.y <= b2.y + b2.height && b1.y + b1.height >= b2.y + b2.height)) {//crossing south
                            const a = getValueAt(b2.y + b2.height, bPoints, 1)
                            const c = a.map(p => ({...p, side:Sides.S}))
                            cPoints.push(...c)
                        }

                        const grace_offset = 1  //TODO
                        if (cPoints.length > 0){
                            cPoints = cPoints.filter((p => (p.point.x >= b2.x - grace_offset && p.point.x <= b2.x + b2.width + grace_offset && p.point.y >= b2.y - grace_offset && p.point.y <= b2.y + b2.height + grace_offset)));
                        }

                        for (const cp of cPoints){
                            const incoming = this.isIncoming(cp.t, canvasCRF, bPoints)

                            let node
                            if (incoming){
                                node = Object.create(edge.source as SKNode)
                            }else{
                                node = Object.create(edge.target as SKNode)
                            }
                            const {node : proxyNode, proxyBounds} = this.getSynthesisProxyRenderingSingle(node as SKNode, ctx)
                            const proxyPoint = Object.create(cp.point) as Point
                            const cross: CrossingPoint = {...cp, incoming: incoming, proxyPoint : proxyPoint, section: i, node: proxyNode, nodeBounds: proxyBounds, anchor: Anchors.towardsEdge}

                            newCrossings.push(cross)
                        }
                    }
                }
    
                crossings.push({edge, crossingPoints: newCrossings, bezierPoints: bezierPoints, pointBounds: pointBounds})

            }else{
                console.log("proxy: Edge hat nicht 3n+1 n>0 Routing Punkte")
            }


        }
        return crossings
    }


    private getAnchorOffsets(bounds: Bounds, side: Sides, anchor: Anchors): {offsetx: number, offsety: number}{
        let offsetx = 0, offsety = 0
        if (anchor == Anchors.towardsMiddle){
            if(side == Sides.N){
                offsetx = bounds.width * 0.5
                offsety = bounds.height
            }else if (side == Sides.E){
                offsetx = 0
                offsety = bounds.height * 0.5
            }else if (side == Sides.S){
                offsetx = bounds.width * 0.5
                offsety = 0
            }else{
                offsetx = bounds.width
                offsety = bounds.height * 0.5
            }
        }else if (anchor == Anchors.center){
            offsetx = bounds.width * 0.5
            offsety = bounds.height * 0.5
        }else if(anchor == Anchors.towardsEdge){
            if(side == Sides.N){
                offsetx = bounds.width * 0.5
                offsety = 0
            }else if (side == Sides.E){
                offsetx = bounds.width
                offsety = bounds.height * 0.5
            }else if (side == Sides.S){
                offsetx = bounds.width * 0.5
                offsety = bounds.height
            }else{
                offsetx = 0
                offsety = bounds.height * 0.5
            }
        }

        return {offsetx, offsety}
    }


    private updateProxyPlacementPoints(crossings : Crossing[], canvasCRF: Canvas): void{
        let anchor = Anchors.towardsMiddle
        let offsetMultiplier = 0
        // if (anchor == Anchors.towardsEdge){
        //     return crossings
        // }else 
        if (anchor == Anchors.towardsMiddle){
            offsetMultiplier = 1
        }else if (anchor == Anchors.center){
            offsetMultiplier = 0.5
        }


        for (const crossing of crossings){
            const crossingpoints = crossing.crossingPoints
            //const crossingpointsections = [0] + crossing.crossingPoints + [crossing.pointBounds.length - 1]
            //const end = crossingpoints[a + direction].section
            //const direction = incoming ? 1 : -1
            //for (let a = 1; a<crossingpoints.length-1; a++){
            for (let a = 0; a<crossingpoints.length; a++){//all crossingPoints
                const cross = crossingpoints[a]
                const side = cross.side

                const {proxyWidth, proxyHeight} = this.transformWidthHeight(cross.nodeBounds, canvasCRF)
                const offsetx = proxyWidth * offsetMultiplier
                const offsety = proxyHeight * offsetMultiplier

                let direction = 1
                let end
                if (cross.incoming){
                    end = a + 1 >= crossingpoints.length ? crossing.pointBounds.length - 1 : crossingpoints[a+1].section
                }else{
                    direction = -1
                    end = a - 1 < 0 ? 0 : crossingpoints[a-1].section
                }

                let bound: Bounds
                if (side == Sides.N || side == Sides.S){
                    bound = {x: canvasCRF.x, y: canvasCRF.y + offsety, width: canvasCRF.width, height : canvasCRF.height - 2 * offsety}
                }else{
                    bound = {x: canvasCRF.x + offsetx, y: canvasCRF.y, width: canvasCRF.width - 2 * offsetx, height : canvasCRF.height}
                }

                for (let pos = cross.section; pos != end + direction; pos += direction){//bis zur nächsten
                    const pointBound = crossing.pointBounds[pos]
                    const bPoints: Point[] = crossing.bezierPoints[pos]

                    if (this.isCrossingBounds(pointBound, bound)){
                        let p
                        if (side == Sides.N){
                            p = getValueAt(bound.y , bPoints, 1)
                        }else if (side == Sides.E){
                            p = getValueAt(bound.x + bound.width, bPoints, 0)
                        }else if (side == Sides.S){
                            p = getValueAt(bound.y + bound.height , bPoints, 1)
                        }else {
                            p = getValueAt(bound.x, bPoints, 0)
                        }


                        const grace_offset = 1  //TODO
                        if (p.length > 0){
                            p = p.filter((p => (p.point.x >= bound.x - grace_offset && p.point.x <= bound.x + bound.width + grace_offset && p.point.y >= bound.y - grace_offset && p.point.y <= bound.y + bound.height + grace_offset)));
                        }
                        if (p.length > 0){
                            console.log("found")
                            crossingpoints[a].proxyPoint = p[0].point
                            crossingpoints[a].anchor = anchor
                            break
                        }
                    }
                }
            }
        }

    }





    //get second crossing, canvas smaller is for white border
    //if second positioning crossing exists, anchor. if not, left anchor, to screen border


    private isIncoming(t : number, bounds: Bounds, bezierPoints: Point[]): boolean{

        let newt = (t > 0.5) ? t - 0.03 : t + 0.03

        const newPoint = computeCubic(newt, bezierPoints)

        let result = false
        if (isInBounds(asBounds(newPoint), bounds)){
            result = true
        }

        return t > 0.5 ? !result : result
    }

    private isCrossingBounds(b1:Bounds, b2:Bounds): boolean{
        return (isInBounds(b1, b2))
                    &&
                    (!((b1.x <= b2.x && b1.x + b1.width >= b2.x + b2.width) &&
                       (b1.y <= b2.y && b1.y + b1.height >= b2.y + b2.height)))
                    &&
                    (!((b1.x >= b2.x && b1.x + b1.width <= b2.x + b2.width) &&
                       (b1.y >= b2.y && b1.y + b1.height <= b2.y + b2.height)))
    }


    // private getCrossingBoundsSides(b1:Bounds, b2:Bounds): String[] {
    //     const ret: String[] = []

    //     if (!this.isCrossingBounds(b1, b2)){
    //         return ret
    //     }

    //     const b1xright = b1.x + b1.width
    //     const b2xright = b2.x + b2.width
    //     const b1ydown = b1.y + b1.height
    //     const b2ydown = b2.y + b2.height

    //     if ((b1.x <= b2.x && b1xright >= b2.x)) {
    //         ret.push("w")
    //     }
    //     if ((b1.x <= b2xright && b1xright >= b2xright)) {
    //         ret.push("e")
    //     }
    //     if ((b1.y <= b2.y && b1ydown >= b2.y)) {
    //         ret.push("n")
    //     }
    //     if ((b1.y <= b2ydown && b1ydown >= b2ydown)) {
    //         ret.push("s")
    //     }

    //     return ret
    // }


    


   

    /** Returns the nodes updated to use the rendering specified by the synthesis. */
    private getSynthesisProxyRenderingSingle(
        node: SKNode,
        ctx: SKGraphModelRenderer
    ): { node: SKNode; proxyBounds: Bounds } {
        // Fallback, if property undefined use universal proxy rendering for this node
        let proxyBounds = node.bounds

        if (
            this.useSynthesisProxyRendering &&
            node.properties &&
            node.properties[ProxyView.PROXY_RENDERING_PROPERTY]
        ) {
            const data = node.properties[ProxyView.PROXY_RENDERING_PROPERTY] as KGraphData[]
            const kRendering = getKRendering(data, ctx)

            if (kRendering && kRendering.properties['klighd.lsp.calculated.bounds']) {
                // Proxy rendering available, update data
                node.data = data
                // Also update the bounds
                proxyBounds = kRendering.properties['klighd.lsp.calculated.bounds'] as Bounds
            }
        }
        return { node, proxyBounds }
        
    }







    /** Returns the proxy rendering for an off-screen node. */
    private createProxy(
        node: SKNode | VNode,
        transform: TransformAttributes,
        ctx: SKGraphModelRenderer,
        idNr: number
    ): VNode | undefined {
        if (!(node instanceof SKNode)) {
            // VNode, this is a predefined rendering (e.g. cluster)
            updateTransform(node, transform, this.viewerOptions.baseDiv)
            return node
        }
        if (node.opacity <= 0) {
            // Don't render invisible nodes
            return undefined
        }

        // Check if this node's proxy should be highlighted
        const highlight = node.selected || (this.highlightSelected && isSelectedOrConnectedToSelected(node))
        const { opacity } = node


        // Get VNode
        // const id = getProxyId(node.id)
        const id = node.id + "$proxy" + idNr
        let vnode = this.renderings.get(id)
        if (!vnode || vnode.selected !== highlight) {
            // Node hasn't been rendered yet (cache empty for this node) or the attributes don't match

            // Change its id to differ from the original node
            node.id = id
            // Clear children, proxies don't show nested nodes (but keep labels)
            node.children = node.children.filter((theNode) => theNode instanceof SKLabel)
            const scale = transform.scale ?? 1
            // Add the proxy's scale to the data
            node.data = this.getNodeData(node.data, scale)
            // Proxies should never appear to be selected (even if their on-screen counterpart is selected)
            // unless highlighting is enabled
            node.selected = highlight
            // Render this node as opaque to change opacity later on
            node.opacity = 1

            vnode = ctx.forceRenderElement(node)
            if (vnode) {
                // New rendering, set ProxyVNode attributes
                vnode.selected = highlight
                ;(vnode as ProxyVNode).proxy = true
                // Add usual mouse interaction
                this.addMouseInteraction(vnode, node)
            }
        }

        if (vnode) {
            // Store this node
            this.renderings.set(id, vnode)
            // Place proxy at the calculated position
            updateTransform(vnode, transform, this.viewerOptions.baseDiv)
            // Update its opacity
            updateOpacity(vnode, opacity, this.viewerOptions.baseDiv)
            // Update whether it should be click-through
            // updateClickThrough(vnode, !this.interactiveProxiesEnabled || this.clickThrough, this.viewerOptions.baseDiv)
            updateClickThrough(vnode, this.clickThrough, this.viewerOptions.baseDiv)
        }

        return vnode
    }

    /** Let the mouseTool decorate this proxy rendering to activate all KLighD- and Proxy-specific mouse interactions. */
    addMouseInteraction(vnode: ProxyVNode, element: SKNode): VNode {
        if (isThunk(vnode)) {
            return vnode
        }
        return this.mouseTool.decorate(vnode, element)
    }

    

    /** Transforms the KGraphData[] to ProxyKGraphData[], e.g. adds the proxyScale attribute to each data. */
    private getNodeData(data: KGraphData[], scale: number): ProxyKGraphData[] {
        if (!data) {
            return data
        }

        const res = []
        for (const d of data) {
            // Add the proxyScale
            const dClone = { ...d, proxyScale: scale, useTitleScaling: this.titleScalingEnabled }
            if ('children' in dClone) {
                // Has children, keep going
                ;(dClone as any).children = this.getNodeData((dClone as any).children, scale)
            }
            res.push(dClone)
        }
        return res
    }


    

    /**
     * Resets the opacity of the given edges.
     * @param modifiedEdges The map containing the edges to reset the opacity for.
     */
    private resetEdgeOpacity(modifiedEdges: Map<any, [SKEdge, number]>): void {
        for (const [edge, opacity] of Array.from(modifiedEdges.values())) {
            edge.opacity = opacity
        }
    }

    /// ///// Misc public methods ////////

    /** Called on mouse down, used for making proxies click-through. */
    setMouseDown(event: MouseEvent): void {
        // Check if the user started the click on a proxy, if not, make click-through
        this.clickThrough = !this.currProxies.some(({ transform }) => Bounds.includes(transform, event))
    }

    /** Called on mouse up, used for making proxies click-through. */
    setMouseUp(): void {
        // Upon release, proxies shouldn't be click-through
        this.clickThrough = false
        this.currProxies.forEach(({ proxy }) =>
            updateClickThrough(proxy, !this.interactiveProxiesEnabled, this.viewerOptions.baseDiv)
        )
    }

    /** Updates the proxy-view options specified in the {@link RenderOptionsRegistry}. */
    updateOptions(renderOptionsRegistry: RenderOptionsRegistry): void {
        this.prevProxyViewEnabled = this.proxyViewEnabled
        this.proxyViewEnabled = renderOptionsRegistry.getValue(ProxyViewEnabled)

        const fromPercent = 0.01
        this.sizePercentage = renderOptionsRegistry.getValue(ProxyViewSize) * fromPercent

        this.interactiveProxiesEnabled = renderOptionsRegistry.getValue(ProxyViewInteractiveProxies)

        this.titleScalingEnabled = renderOptionsRegistry.getValue(ProxyViewTitleScaling)

        // Debug
        this.highlightSelected = renderOptionsRegistry.getValue(ProxyViewHighlightSelected)

        const useSynthesisProxyRendering = renderOptionsRegistry.getValue(ProxyViewUseSynthesisProxyRendering)
        if (this.useSynthesisProxyRendering !== useSynthesisProxyRendering) {
            // Make sure not to use the wrong renderings if changed
            this.clearRenderings()
        }
        this.useSynthesisProxyRendering = useSynthesisProxyRendering

        this.transparentEdges = renderOptionsRegistry.getValue(ProxyViewTransparentEdges)
        if (!this.transparentEdges && this.prevModifiedEdges.size > 0) {
            // Reset opacity of all edges
            this.resetEdgeOpacity(this.prevModifiedEdges)
            this.prevModifiedEdges.clear()
        }

        this.originalNodeScale = renderOptionsRegistry.getValue(ProxyViewOriginalNodeScale)
        this.capScaleToOne = renderOptionsRegistry.getValue(ProxyViewCapScaleToOne)

    }

    /**
     * Registers all given `filters` to be evaluated before showing a proxy.
     *
     * Try ordering the given filters by strongest filter criterion first,
     * secondary ordering by simplicity/cost of check. This ensures:
     * - proxies being filtered out early, therefore reducing the number of filters
     * that need to be evaluated
     * - less costly filters being applied first, potentially avoiding more expensive ones
     */
    registerFilters(...filters: ProxyFilterAndID[]): void {
        filters.forEach(({ id, filter }) => this.filters.set(id, filter))
    }

    /** Unregisters all given `filters`. */
    unregisterFilters(...filters: ProxyFilterAndID[]): boolean {
        return filters.every(({ id }) => this.filters.delete(id))
    }

    /** Resets the proxy-view, i.e. when the model is updated. */
    reset(): void {
        this.clearRenderings()
        this.clearDistances()
    }

    /** Clears the {@link renderings} map. */
    clearRenderings(): void {
        this.renderings.clear()
    }

    /** Clears the {@link distances} map. */
    clearDistances(): void {
        this.distances.clear()
    }
}

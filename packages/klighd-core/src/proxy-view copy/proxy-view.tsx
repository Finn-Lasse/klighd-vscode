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
    ProxyViewDecreaseProxyClutter,
    ProxyViewEnableEdgeProxies,
    ProxyViewEnabled,
    ProxyViewHighlightSelected,
    ProxyViewInteractiveProxies,
    ProxyViewOriginalNodeScale,
    ProxyViewShowProxiesEarly,
    ProxyViewShowProxiesEarlyNumber,
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
    computeCubic
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

    /** @see {@link ProxyViewShowProxiesEarly} */
    private showProxiesEarly: boolean

    /** @see {@link ProxyViewShowProxiesEarlyNumber} */
    private showProxiesEarlyNumber: number

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

        // Calculate size of proxies
        const size = Math.min(canvasVRF.width, canvasVRF.height) * this.sizePercentage

        const fromPercent = 0.01
        // The amount of pixels to offset the CRF canvas size by 1%.
        const onePercentOffsetCRF = Math.min(canvasCRF.width, canvasCRF.height) * fromPercent

        /// / Initial nodes ////
        // Reduce canvas size to show proxies early
        const sizedCanvas = this.showProxiesEarly
            ? Canvas.offsetCanvas(canvasCRF, this.showProxiesEarlyNumber * onePercentOffsetCRF)
            : canvasCRF

        const crossingEdges = this.getPossibleEdges(root, sizedCanvas)

        const crossings = this.getCrossings(crossingEdges, sizedCanvas)

        const crossingsWithNode = this.getCorrespondingCrossingNodes(crossings)

        const crossingsNodeBounds = this.getCorrespondingSynthesis(crossingsWithNode, ctx)

        const crossingsWithTransform = this.getCrossingTransform(crossingsNodeBounds, size, canvasVRF)


        // if (crossingEdges.length > 5000){
        //     console.log(crossingEdges.length)
        //     console.log(crossings)
        //     // console.log(crossingsWithNode)
        // }


        const proxies = []
        this.currProxies = []

        let idNr = 1
        // Nodes
        for (const crossing of crossingsWithTransform) {
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


    /**
     * Calculates the TransformAttributes for this node's proxy, e.g. the position to place the proxy at aswell as its scale and bounds.
     * Note that the position is pre-scaling. To get position post-scaling, divide `x` and `y` by `scale`.
     */
    private getTransform(node: SKNode, point: Point, desiredSize: number, proxyBounds: Bounds, canvas: Canvas): TransformAttributes {
        // Calculate the scale and the resulting proxy dimensions
        // The scale is calculated such that width & height are capped to a max value
        const proxyWidthScale = desiredSize / proxyBounds.width
        const proxyHeightScale = desiredSize / proxyBounds.height
        let scale = this.originalNodeScale ? canvas.zoom : Math.min(proxyWidthScale, proxyHeightScale)
        scale = this.capScaleToOne ? Math.min(1, scale) : scale
        const proxyWidth = proxyBounds.width * scale
        const proxyHeight = proxyBounds.height * scale

        // Center at middle of node
        const translated = Canvas.translateToVRF(point, canvas)

        const offsetX = 0.5 * (translated.width - proxyWidth)
        const offsetY = 0.5 * (translated.height - proxyHeight)
        let x = translated.x + offsetX
        let y = translated.y + offsetY

        // Cap proxy to canvas
        ;({ x, y } = Canvas.capToCanvas({ x, y, width: proxyWidth, height: proxyHeight }, canvas))

        return { x, y, scale, width: proxyWidth, height: proxyHeight }
    }

    // private getCorrespondingNode(
    //     edge: SKEdge,
    //     incoming: Boolean,
    // ): SKNode[] {
    //     if (incoming){
    //         return Object.create(edge.source as SKNode)
    //     }else{
    //         return Object.create(edge.target as SKNode)
    //     }
    // }

    private getCrossingTransform(
        crossings: Crossing[],
        size: number,
        canvasVRF: Canvas,
    ): Crossing[] {
        for (const crossing of crossings){
            for (const cp of crossing.crossingPoints){
                if (cp.node){
                    cp.nodeBounds = this.getTransform(cp.node, cp.point, size, cp.nodeBounds as Bounds, canvasVRF)
                }
            }
        }
        
        return crossings
    }

    private getCorrespondingCrossingNodes(
        crossings: Crossing[],
    ): Crossing[] {
        for (const crossing of crossings){
            for (const cp of crossing.crossingPoints){
                if (cp.incoming){
                    cp.node = Object.create(crossing.edge.source as SKNode)
                }else{
                    cp.node = Object.create(crossing.edge.target as SKNode)
                }
            }
        }
        return crossings
    }

    private getCorrespondingSynthesis(
        crossings: Crossing[],
        ctx: SKGraphModelRenderer
    ): Crossing[] {
        // getSynthesisProxyRenderingSingle
        for (const crossing of crossings){
            for (const cp of crossing.crossingPoints){
                const {node, proxyBounds} = this.getSynthesisProxyRenderingSingle(cp.node as SKNode, ctx)
                cp.node = node
                cp.nodeBounds = proxyBounds
            }
        }
        return crossings
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

            if (rpoints.length % 3 == 1 && rpoints.length >= 4){
                for(let i = 0; i  < Math.floor(rpoints.length/3); i++){
                    const bpoints = rpoints.slice(i*3, i*3 + 4)
                    // pointBounds.push(Canvas.translateToCRF(getBoundsFromPoints(bpoints), canvas))
                    pointBounds.push(getBoundsFromPoints(bpoints))
                    bezierPoints.push(bpoints)
                }


                for (let i = 0; i < pointBounds.length; i++){
                    const pointBound = pointBounds[i]
                    const bPoints: Point[] = bezierPoints[i]

                    if (this.isCrossingBounds(pointBound, canvasCRF)){
                        const b1 = pointBound
                        const b2 = canvasCRF

                        let cPoints: {point: Point, t: number}[] = []
                        // const offsetx = (b2.width / 20)
                        // const offsety = (b2.height / 20)
                        const offsetx = 0
                        const offsety = 0

                        if ((b1.x <= b2.x && b1.x + b1.width >= b2.x)) {
                            cPoints.push(...getValueAt(b2.x + offsetx, bPoints, 0))
                        }
                        if ((b1.x <= b2.x + b2.width && b1.x + b1.width >= b2.x + b2.width)) {
                            cPoints.push(...getValueAt(b2.x + b2.width - offsetx, bPoints, 0))
                        }
                        if ((b1.y <= b2.y && b1.y + b1.height >= b2.y)) {
                            cPoints.push(...getValueAt(b2.y + offsety, bPoints, 1))
                        }
                        if ((b1.y <= b2.y + b2.height && b1.y + b1.height >= b2.y + b2.height)) {
                            cPoints.push(...getValueAt(b2.y + b2.height - offsety, bPoints, 1))
                        }
                        
                        const grace_offset = 1          //TODO : besser machen. vmtl mit zur mitte Runden
                        if (cPoints.length > 0){
                            cPoints = cPoints.filter((p => (p.point.x >= b2.x - grace_offset && p.point.x <= b2.x + b2.width + grace_offset && p.point.y >= b2.y - grace_offset && p.point.y <= b2.y + b2.height + grace_offset)));
                        }

                        if (cPoints.length > 0){
                            const cross = []

                            for (const {point, t} of cPoints){
                                const incoming = this.isIncoming(t, canvasCRF, bPoints)
                                cross.push({point, incoming})
                            }
                            crossings.push({edge, crossingPoints: cross})
                        }

                    }
                }

            }else{
                console.log("proxy: Edge hat nicht 3n+1 n>0 Routing Punkte")
            }


        }
        return crossings
    }


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

        switch (renderOptionsRegistry.getValue(ProxyViewDecreaseProxyClutter)) {
            case ProxyViewDecreaseProxyClutter.CHOICE_OFF:
                break
            case ProxyViewDecreaseProxyClutter.CHOICE_CLUSTERING:
                break
            case ProxyViewDecreaseProxyClutter.CHOICE_OPACITY:
                break
            default:
                console.error('unexpected case for ProxyViewDecreaseProxyClutter in proxy-view.')
        }

        switch (renderOptionsRegistry.getValue(ProxyViewEnableEdgeProxies)) {
            case ProxyViewEnableEdgeProxies.CHOICE_OFF:
                break
            case ProxyViewEnableEdgeProxies.CHOICE_STRAIGHT_EDGE_ROUTING:
                break
            case ProxyViewEnableEdgeProxies.CHOICE_ALONG_BORDER_ROUTING:
                break
            default:
                console.error('unexpected case for ProxyViewEnableEdgeProxies in proxy-view.')
        }


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

        this.showProxiesEarly = renderOptionsRegistry.getValue(ProxyViewShowProxiesEarly)
        this.showProxiesEarlyNumber = renderOptionsRegistry.getValue(ProxyViewShowProxiesEarlyNumber)

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

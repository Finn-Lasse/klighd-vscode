/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2022-2023 by
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

import { Range, RangeOption, RenderOption, TransformationOptionType } from '../options/option-models'

/** The category containing proxy-view options. */
export class ProxyViewCategory implements RenderOption {
    static readonly ID: string = 'proxy-view-category'

    static readonly NAME: string = 'Proxy-View'

    static readonly INSTANCE: ProxyViewCategory = new ProxyViewCategory()

    readonly id: string = ProxyViewCategory.ID

    readonly name: string = ProxyViewCategory.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CATEGORY

    readonly initialValue: any

    currentValue: any
}

/** Whether the proxy-view is enabled. */
export class ProxyViewEnabled implements RenderOption {
    static readonly ID: string = 'proxy-view-enabled'

    static readonly NAME: string = 'Proxy View'

    static readonly DESCRIPTION: string = 'Enables proxies for off-screen elements.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewEnabled.ID

    readonly name: string = ProxyViewEnabled.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewEnabled.DEFAULT

    readonly description: string = ProxyViewEnabled.DESCRIPTION

    readonly renderCategory: string = ProxyViewCategory.ID

    currentValue = ProxyViewEnabled.DEFAULT
}

/** Part of calculating the proxies' size. */
export class ProxyViewSize implements RangeOption {
    static readonly ID: string = 'proxy-view-size'

    static readonly NAME: string = 'Size of Proxies in %'

    static readonly DESCRIPTION: string =
        "Percentage to which the proxies are scaled regarding the minimum of the canvas' height and width."

    static readonly DEFAULT: number = 8

    static readonly RANGE: Range = { first: 1, second: 25 }

    static readonly STEPSIZE: number = 1

    readonly id: string = ProxyViewSize.ID

    readonly name: string = ProxyViewSize.NAME

    readonly type: TransformationOptionType = TransformationOptionType.RANGE

    readonly initialValue: number = ProxyViewSize.DEFAULT

    readonly description: string = ProxyViewSize.DESCRIPTION

    readonly renderCategory: string = ProxyViewCategory.ID

    readonly range: Range = ProxyViewSize.RANGE

    readonly stepSize: number = ProxyViewSize.STEPSIZE

    readonly values: any[] = []

    currentValue = ProxyViewSize.DEFAULT

    debug = true
}




/** Whether to use title scaling if smart zoom is enabled. */
export class ProxyViewTitleScaling implements RenderOption {
    static readonly ID: string = 'proxy-view-title-scaling'

    static readonly NAME: string = 'Scale Proxy Titles'

    static readonly DESCRIPTION: string = "Whether a proxy's title should be scaled if smart zoom is enabled."

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewTitleScaling.ID

    readonly name: string = ProxyViewTitleScaling.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewTitleScaling.DEFAULT

    readonly description: string = ProxyViewTitleScaling.DESCRIPTION

    readonly renderCategory: string = ProxyViewCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewTitleScaling.DEFAULT
}


/// ///// DEBUG ////////

/** The category containing debug proxy-view options. */
export class ProxyViewDebugCategory implements RenderOption {
    static readonly ID: string = 'proxy-view-debug-category'

    static readonly NAME: string = 'Proxy-View Debug Options'

    static readonly INSTANCE: ProxyViewDebugCategory = new ProxyViewDebugCategory()

    readonly id: string = ProxyViewDebugCategory.ID

    readonly name: string = ProxyViewDebugCategory.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CATEGORY

    readonly initialValue: any

    readonly debug: boolean = true

    currentValue: any
}

/** Whether proxies should be interactable. */
export class ProxyViewInteractiveProxies implements RenderOption {
    static readonly ID: string = 'proxy-view-interactive-proxies'

    static readonly NAME: string = 'Interactive Proxies'

    static readonly DESCRIPTION: string =
        'Whether proxies should be interactable. Clicking on a proxy hops to its off-screen counterpart.'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewInteractiveProxies.ID

    readonly name: string = ProxyViewInteractiveProxies.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewInteractiveProxies.DEFAULT

    readonly description: string = ProxyViewInteractiveProxies.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewInteractiveProxies.DEFAULT
}

/** Whether to highlight proxies that are connected to the selected node. */
export class ProxyViewHighlightSelected implements RenderOption {
    static readonly ID: string = 'proxy-view-highlight-selected'

    static readonly NAME: string = 'Highlight Proxies by Selection'

    static readonly DESCRIPTION: string =
        'Whether proxies that are connected to the selected node should be highlighted.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewHighlightSelected.ID

    readonly name: string = ProxyViewHighlightSelected.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewHighlightSelected.DEFAULT

    readonly description: string = ProxyViewHighlightSelected.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewHighlightSelected.DEFAULT
}

/** Whether to decrease opacity of proxies that are not connected to the selected node and increase otherwise. */
export class ProxyViewOpacityBySelected implements RenderOption {
    static readonly ID: string = 'proxy-view-opacity-by-selected'

    static readonly NAME: string = 'Transparent Proxies by Selection'

    static readonly DESCRIPTION: string =
        'Whether proxies that are not connected to the selected node should be more transparent.'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewOpacityBySelected.ID

    readonly name: string = ProxyViewOpacityBySelected.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewOpacityBySelected.DEFAULT

    readonly description: string = ProxyViewOpacityBySelected.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewOpacityBySelected.DEFAULT
}

/** Whether to use the synthesis specified proxy-rendering. */
export class ProxyViewUseSynthesisProxyRendering implements RenderOption {
    static readonly ID: string = 'proxy-view-use-synthesis-proxy-rendering'

    static readonly NAME: string = 'Use Synthesis Proxy-Rendering'

    static readonly DESCRIPTION: string =
        'Whether proxies should be rendered as specified by the synthesis (if specified).'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewUseSynthesisProxyRendering.ID

    readonly name: string = ProxyViewUseSynthesisProxyRendering.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewUseSynthesisProxyRendering.DEFAULT

    readonly description: string = ProxyViewUseSynthesisProxyRendering.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewUseSynthesisProxyRendering.DEFAULT
}

/** Whether to cap proxies in their parent node. */
export class ProxyViewCapProxyToParent implements RenderOption {
    static readonly ID: string = 'proxy-view-cap-proxy-to-parent'

    static readonly NAME: string = 'Cap Proxy to Parent'

    static readonly DESCRIPTION: string = 'Whether proxies should be capped inside their parent node.'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewCapProxyToParent.ID

    readonly name: string = ProxyViewCapProxyToParent.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewCapProxyToParent.DEFAULT

    readonly description: string = ProxyViewCapProxyToParent.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewCapProxyToParent.DEFAULT
}

/** Whether proxies should be shown for nodes that aren't rendered because of the parent's detail level. */
export class ProxyViewUseDetailLevel implements RenderOption {
    static readonly ID: string = 'proxy-view-use-detail-level'

    static readonly NAME: string = 'Use Detail Level'

    static readonly DESCRIPTION: string =
        "Whether proxies should be shown for nodes that aren't rendered because of the parent's detail level."

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewUseDetailLevel.ID

    readonly name: string = ProxyViewUseDetailLevel.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewUseDetailLevel.DEFAULT

    readonly description: string = ProxyViewUseDetailLevel.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewUseDetailLevel.DEFAULT
}


/** Whether edges should become transparent when the corresponding edge proxies are on-screen. This actually modifies the diagram. */
export class ProxyViewTransparentEdges implements RenderOption {
    static readonly ID: string = 'proxy-view-transparent-edges'

    static readonly NAME: string = 'Fade Out Edges'

    static readonly DESCRIPTION: string =
        'Whether edges should become transparent when the corresponding edge proxies are on-screen. This actually modifies the diagram.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewTransparentEdges.ID

    readonly name: string = ProxyViewTransparentEdges.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewTransparentEdges.DEFAULT

    readonly description: string = ProxyViewTransparentEdges.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewTransparentEdges.DEFAULT
}

/** Whether proxies should be as big as their corresponding node. */
export class ProxyViewOriginalNodeScale implements RenderOption {
    static readonly ID: string = 'proxy-view-original-node-scale'

    static readonly NAME: string = 'Original Node Scale'

    static readonly DESCRIPTION: string = 'Whether proxies should be as big as their corresponding node.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewOriginalNodeScale.ID

    readonly name: string = ProxyViewOriginalNodeScale.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewOriginalNodeScale.DEFAULT

    readonly description: string = ProxyViewOriginalNodeScale.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewOriginalNodeScale.DEFAULT
}

/** Whether to cap scaling of proxies to 1. */
export class ProxyViewCapScaleToOne implements RenderOption {
    static readonly ID: string = 'proxy-view-cap-scale-to-one'

    static readonly NAME: string = 'Cap Scaling to 1'

    static readonly DESCRIPTION: string = 'Whether proxies should be upscaled more than their original size.'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewCapScaleToOne.ID

    readonly name: string = ProxyViewCapScaleToOne.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewCapScaleToOne.DEFAULT

    readonly description: string = ProxyViewCapScaleToOne.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewCapScaleToOne.DEFAULT
}

/** Whether proxies that overlap nodes should be filtered. */
export class ProxyViewFilterProxyOverlappingNode implements RenderOption {
    static readonly ID: string = 'proxy-view-filter-proxy-overlapping-node'

    static readonly NAME: string = 'Filter Proxys that overlap nodes'

    static readonly DESCRIPTION: string = 'Whether proxies that overlap nodes should be filtered.'

    static readonly DEFAULT: boolean = true

    readonly id: string = ProxyViewFilterProxyOverlappingNode.ID

    readonly name: string = ProxyViewFilterProxyOverlappingNode.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewFilterProxyOverlappingNode.DEFAULT

    readonly description: string = ProxyViewFilterProxyOverlappingNode.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewFilterProxyOverlappingNode.DEFAULT
}

/** Whether proxies with the chosen anchor should be shown with a different anchor if it can\'t be shown with the chosen anchor. */
export class ProxyViewUseFallbackAnchor implements RenderOption {
    static readonly ID: string = 'proxy-view-use-fallback-anchor'

    static readonly NAME: string = 'Use Fallback Anchor'

    static readonly DESCRIPTION: string = 'Whether proxies with the chosen anchor should be shown with a different anchor if it can\'t be shown with the chosen anchor.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewUseFallbackAnchor.ID

    readonly name: string = ProxyViewUseFallbackAnchor.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewUseFallbackAnchor.DEFAULT

    readonly description: string = ProxyViewUseFallbackAnchor.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewFilterProxyOverlappingNode.DEFAULT
}

/** Where proxys should be placed in relation to edges. */
export class ProxyViewAnchor implements RenderOption {
    static readonly ID: string = 'proxy-view-anchor'

    static readonly NAME: string = 'Anchor'

    static readonly DESCRIPTION: string = 'Where proxys should be placed in relation to edges.'

    static readonly CHOICE_TOWARDS_EDGE: string = 'Towards Screen Edge'

    static readonly CHOICE_CENTERED: string = 'Centered'

    static readonly CHOICE_TOWARDS_MIDDLE: string = 'Towards Screen Middle'

    static readonly DEFAULT: string = ProxyViewAnchor.CHOICE_TOWARDS_MIDDLE

    static readonly CHOICES: string[] = [
        ProxyViewAnchor.CHOICE_TOWARDS_EDGE,
        ProxyViewAnchor.CHOICE_CENTERED,
        ProxyViewAnchor.CHOICE_TOWARDS_MIDDLE,
    ]

    readonly id: string = ProxyViewAnchor.ID

    readonly name: string = ProxyViewAnchor.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHOICE

    readonly initialValue: string = ProxyViewAnchor.DEFAULT

    readonly description: string = ProxyViewAnchor.DESCRIPTION

    readonly renderCategory: string = ProxyViewCategory.ID

    readonly values: string[] = ProxyViewAnchor.CHOICES

    readonly debug: boolean = true

    currentValue = ProxyViewAnchor.DEFAULT
}

/** Whether proxies should be shown on a border, hiding parts of the diagram. */
export class ProxyViewReservedBorder implements RenderOption {
    static readonly ID: string = 'proxy-view-reserved-border'

    static readonly NAME: string = 'Use Reserved Border'

    static readonly DESCRIPTION: string = 'Whether proxies should be shown on a border, hiding parts of the diagram.'

    static readonly DEFAULT: boolean = false

    readonly id: string = ProxyViewReservedBorder.ID

    readonly name: string = ProxyViewReservedBorder.NAME

    readonly type: TransformationOptionType = TransformationOptionType.CHECK

    readonly initialValue: boolean = ProxyViewReservedBorder.DEFAULT

    readonly description: string = ProxyViewReservedBorder.DESCRIPTION

    readonly renderCategory: string = ProxyViewDebugCategory.ID

    readonly debug: boolean = true

    currentValue = ProxyViewFilterProxyOverlappingNode.DEFAULT
}
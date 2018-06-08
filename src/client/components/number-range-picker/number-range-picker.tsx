/*
 * Copyright 2015-2016 Imply Data, Inc.
 * Copyright 2017-2018 Allegro.pl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { $, Dataset, ply } from "plywood";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Dimension, Essence, Timekeeper } from "../../../common/models/index";
import { getNumberOfWholeDigits, toSignificantDigits } from "../../../common/utils/general/general";
import { clamp, classNames, getXFromEvent } from "../../utils/dom/dom";
import { Loader } from "../loader/loader";
import { QueryError } from "../query-error/query-error";
import { RangeHandle } from "../range-handle/range-handle";
import "./number-range-picker.scss";

export const ANY_VALUE: any = null;

const NUB_SIZE = 16;
const GRANULARITY_IN_BAR = 300; // this is how many steps we want to represent in the slider bar

function addNubSize(value: number) {
  return value + NUB_SIZE;
}

function subtractNubSize(value: number) {
  return value && value > NUB_SIZE ? value - NUB_SIZE : 0;
}

function getNumberOfDigitsToShow(n: number) {
  var totalDigits = getNumberOfWholeDigits(n / GRANULARITY_IN_BAR);
  return totalDigits > 3 ? Math.min(totalDigits, 4) : 3;
}

// offset the bar a little because a rectangle at the same position as a circle will peek through
function getAdjustedStartHalf(start: number) {
  return start + NUB_SIZE / 2;
}

export interface NumberRangePickerProps {
  start: number;
  end: number;
  essence: Essence;
  timekeeper: Timekeeper;
  dimension: Dimension;
  onRangeStartChange: (n: number) => void;
  onRangeEndChange: (n: number) => void;
  exclude: boolean;
}

export interface NumberRangePickerState {
  leftOffset?: number;
  rightBound?: number;
  min?: number;
  max?: number;
  step?: number;
  loading?: boolean;
  error?: any;
}

export class NumberRangePicker extends React.Component<NumberRangePickerProps, NumberRangePickerState> {
  public mounted: boolean;

  constructor(props: NumberRangePickerProps) {
    super(props);
    this.state = {
      min: null,
      max: null,
      step: null,
      loading: false,
      error: null
    };
  }

  fetchData(essence: Essence, timekeeper: Timekeeper, dimension: Dimension, rightBound: number): void {
    var { dataCube } = essence;
    var filterExpression = essence.getEffectiveFilter(timekeeper, null, dimension).toExpression();
    var $main = $("main");
    var query = ply()
      .apply("main", $main.filter(filterExpression))
      .apply("Min", $main.min($(dimension.name)))
      .apply("Max", $main.max($(dimension.name)));

    this.setState({
      loading: true
    });

    dataCube.executor(query)
      .then(
        (dataset: Dataset) => {
          if (!this.mounted) return;
          var min = (dataset.data[0]["Min"] as number);
          var max = (dataset.data[0]["Max"] as number);

          var step = max && min && isFinite(max) && isFinite(min) ? (max - min) / rightBound : 1;

          this.setState({
            min,
            max,
            loading: false,
            step: step !== 0 && isFinite(step) ? step : 1
          });
        },
        error => {
          if (!this.mounted) return;
          this.setState({
            loading: false,
            error
          });
        }
      );
  }

  componentDidMount() {
    this.mounted = true;
    var node = ReactDOM.findDOMNode(this.refs["number-range-picker"]);
    var rect = node.getBoundingClientRect();
    var { essence, timekeeper, dimension } = this.props;
    var leftOffset = rect.left;
    var rightBound = rect.width;

    this.setState({ leftOffset, rightBound });
    this.fetchData(essence, timekeeper, dimension, rightBound);

  }

  componentWillUnmount() {
    this.mounted = false;
  }

  relativePositionToValue(position: number, type: "start" | "end") {
    const { step, min, max, rightBound } = this.state;
    if (position <= addNubSize(0) && type === "start") return ANY_VALUE;
    if (position >= rightBound && type === "end") return ANY_VALUE;

    var range = max - min !== 0 ? max - min : Math.abs(max);
    return toSignificantDigits(position * step, getNumberOfDigitsToShow(range));
  }

  valueToRelativePosition(value: number) {
    const { step } = this.state;
    return value / step;
  }

  onBarClick(positionStart: number, positionEnd: number, e: MouseEvent) {
    const { leftOffset } = this.state;

    var clickPadding = 5;
    var absoluteX = getXFromEvent(e);
    var relativeX = absoluteX - leftOffset;
    if (relativeX < NUB_SIZE / 2) return this.updateStart(leftOffset);

    var startNubPosition = addNubSize(positionStart) + clickPadding;
    var endNubPosition = subtractNubSize(positionEnd) + clickPadding;

    var isBeforeStart = relativeX < positionStart;
    var isAfterEnd = relativeX > positionEnd + NUB_SIZE;
    var inBetween = (relativeX < positionEnd) && relativeX > startNubPosition;

    if (isBeforeStart) {
      this.updateStart(absoluteX - NUB_SIZE);
    } else if (isAfterEnd) {
      this.updateEnd(absoluteX);
    } else if (inBetween) {

      var distanceFromEnd = endNubPosition - relativeX;
      var distanceFromStart = relativeX - startNubPosition;

      if (distanceFromEnd < distanceFromStart) {
        this.updateEnd(endNubPosition + leftOffset - distanceFromEnd);
      } else {
        this.updateStart(startNubPosition + leftOffset + distanceFromStart - NUB_SIZE);
      }
      return;
    }
  }

  updateStart(absolutePosition: number) {
    const { onRangeStartChange } = this.props;
    const { leftOffset } = this.state;

    var relativePosition = absolutePosition - leftOffset;
    var newValue = this.relativePositionToValue(addNubSize(relativePosition), "start");
    onRangeStartChange(newValue);
  }

  updateEnd(absolutePosition: number) {
    const { onRangeEndChange } = this.props;
    const { leftOffset } = this.state;

    var relativePosition = absolutePosition - leftOffset;
    var newValue = this.relativePositionToValue(relativePosition, "end");

    onRangeEndChange(newValue);
  }

  render() {
    const { start, end, exclude } = this.props;
    const { min, max, loading, error, step, rightBound, leftOffset } = this.state;

    var content: JSX.Element = null;

    if (rightBound && step && isFinite(max) && isFinite(min)) {
      var relativeStart = start === ANY_VALUE ? 0 : subtractNubSize(this.valueToRelativePosition(start));
      var relativeEnd = end === ANY_VALUE ? rightBound : this.valueToRelativePosition(end);
      var adjustedRightBound = subtractNubSize(rightBound);

      var positionEnd = clamp(relativeEnd, addNubSize(relativeStart), adjustedRightBound);
      var positionStart = start ? clamp(relativeStart, 0, subtractNubSize(positionEnd)) : 0;

      var rangeBarSelected = { left: getAdjustedStartHalf(positionStart), width: positionEnd - positionStart };

      var absoluteRightBound = leftOffset + rightBound;

      content = <div className="range-slider" onMouseDown={this.onBarClick.bind(this, positionStart, positionEnd)}>
        <div className="range-bar full" />
        <div className="range-bar selected" style={rangeBarSelected} />
        <RangeHandle
          positionLeft={positionStart}
          onChange={this.updateStart.bind(this)}
          isAny={start === ANY_VALUE}
          isBeyondMin={start !== ANY_VALUE && start < min}
          leftBound={leftOffset}
          rightBound={leftOffset + subtractNubSize(positionEnd)}
          offset={leftOffset}
        />
        <RangeHandle
          positionLeft={positionEnd}
          onChange={this.updateEnd.bind(this)}
          isAny={end === ANY_VALUE}
          isBeyondMax={end !== ANY_VALUE && max < end}
          leftBound={leftOffset + addNubSize(positionStart)}
          rightBound={absoluteRightBound}
          offset={leftOffset}
        />
      </div>;
    }

    return <div className={classNames("number-range-picker", { inverted: exclude })} ref="number-range-picker">
      {content}
      {loading ? <Loader /> : null}
      {error ? <QueryError error={error} /> : null}
    </div>;
  }
}
